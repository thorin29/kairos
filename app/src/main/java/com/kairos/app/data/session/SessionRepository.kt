package com.kairos.app.data.session

import com.kairos.app.data.remote.ApiClient
import com.kairos.app.data.remote.ApiError
import com.kairos.app.data.remote.ApiException
import com.kairos.app.data.remote.ApiService
import com.kairos.app.data.remote.apiCall
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import com.kairos.app.data.remote.dto.DashboardDto
import com.kairos.app.data.remote.dto.LoginRequest
import com.kairos.app.data.remote.dto.PersonDto
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import com.kairos.app.data.remote.dto.ReauthRequest
import com.kairos.app.data.remote.dto.TaskStatusDto
import com.kairos.app.data.remote.dto.WorkoutAckDto
import com.kairos.app.data.remote.dto.WorkoutDateRequest
import retrofit2.Response
import com.kairos.app.data.secure.TokenStore
import com.kairos.app.data.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

/** Top-level app state derived from stored config + token validity. */
sealed interface SessionState {
    data object Loading : SessionState
    /** No server URL configured yet — first launch. */
    data object NeedsSetup : SessionState
    /** Server known, but no valid device token — needs to redeem a code. */
    data object NeedsEnroll : SessionState
    /** Device still enrolled, but the account password changed — re-enter it. */
    data class NeedsReauth(val person: PersonDto?) : SessionState
    /** Enrolled but logged out — locked to [person]. Username + password (theirs)
     *  gets back in; no new code. A blank phone can't reach this state. */
    data class Locked(val person: PersonDto) : SessionState
    /** Enrolled, but the server rejected this device's token. The token is KEPT
     *  (never destroyed automatically): a later successful validation silently
     *  restores the session, and recovery keeps the credential as evidence. Only
     *  a deliberate re-enroll, server change, or forgetDevice() clears it. */
    data class DeviceInvalid(val person: PersonDto?) : SessionState
    /** Enrolled; [person] came from /me. */
    data class Ready(val person: PersonDto) : SessionState
}

/**
 * Owns identity for the whole app: the configured server, the device token, and
 * the enrolled person. It's the single place that decides which top-level graph
 * shows. The OkHttp service is rebuilt only when the base URL changes; token
 * changes are picked up through the in-memory [TokenStore] the interceptor reads.
 */
class SessionRepository(
    private val settings: SettingsStore,
    private val tokens: TokenStore,
    private val appScope: CoroutineScope,
    private val httpCache: okhttp3.Cache? = null,
    private val networkMonitor: com.kairos.app.data.remote.NetworkMonitor? = null,
    private val writeQueue: com.kairos.app.data.remote.WriteQueue? = null,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    /** The last person cached from /me, decoded, or null. Used to show a friendly
     *  "reconnect" screen when the device token is rejected without losing who was
     *  enrolled. */
    private suspend fun cachedPerson(): PersonDto? =
        settings.currentCachedPerson()
            ?.let { runCatching { json.decodeFromString<PersonDto>(it) }.getOrNull() }

    /** Fires when a task changes outside the on-screen flow (e.g. completed from a
     *  notification), so an open Home/Tasks screen can refresh instead of showing
     *  a stale checkbox until a manual reload. */
    private val _tasksChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val tasksChanged: SharedFlow<Unit> = _tasksChanged.asSharedFlow()

    /** Raw configured origin (no /api/v1), for resolving avatar URLs later. */
    @Volatile
    var baseUrlRaw: String? = null
        private set

    private var service: ApiService? = null

    init {
        appScope.launch { bootstrap() }
    }

    private fun rebuildService(rawBase: String) {
        baseUrlRaw = rawBase
        service = ApiClient.create(rawBase, httpCache, networkMonitor, writeQueue) { tokens.current() }
    }

    /** Decide the start destination on launch. */
    /** Persist why an enrolled phone lost its session, so the next occurrence is
     *  diagnosable instead of a mystery. Safe metadata only — never the token. */
    private suspend fun noteEnrollLoss(reason: String) {
        runCatching {
            settings.setEnrollLossReason(
                "$reason · v${com.kairos.app.BuildConfig.VERSION_NAME} · ${java.util.Date()}",
            )
        }
    }

    suspend fun bootstrap() {
        val url = settings.currentBaseUrl()
        if (url.isNullOrBlank()) {
            _state.value = SessionState.NeedsSetup
            return
        }
        val hadBlob = tokens.blobExists()
        val token = tokens.load()
        if (token.isNullOrBlank()) {
            noteEnrollLoss(
                if (hadBlob) "decrypt_failed@boot keyAlias=${com.kairos.app.data.secure.TokenCrypto.aliasExists()}"
                else "no_token@boot",
            )
            _state.value = SessionState.NeedsEnroll
            return
        }
        // Build the authenticated service only AFTER the token is loaded, so a
        // concurrent background call (e.g. the notification worker at cold start)
        // can never race a window where the service exists but the token is null.
        rebuildService(url)
        // Logged out on this (still-enrolled) phone: resume to the lock screen.
        settings.currentLockedPerson()?.let { js ->
            runCatching { json.decodeFromString<PersonDto>(js) }.getOrNull()?.let {
                _state.value = SessionState.Locked(it)
                return
            }
        }
        // Validate the stored token by fetching the person. A real auth failure
        // clears the token; a transient failure (server restarting, no network)
        // must NOT look like a lost enrollment, so retry a few times and then
        // resume from the last known person instead of showing "set up this
        // phone".
        repeat(3) { attempt ->
            try {
                val person = apiCall { service!!.me() }
                settings.setCachedPerson(json.encodeToString(person))
                _state.value = SessionState.Ready(person)
                return
            } catch (e: ApiException) {
                when (e.error) {
                    is ApiError.ReauthRequired -> {
                        // Device still enrolled; the password changed. Keep the token.
                        _state.value = SessionState.NeedsReauth(null)
                        return
                    }
                    is ApiError.Unauthenticated -> {
                        // The stored token was rejected. DON'T destroy it: keep it so
                        // a later boot can silently restore the session if this was a
                        // transient/false rejection, and so recovery has the credential
                        // as evidence. Surface a distinct "reconnect" state instead of
                        // a blank re-enroll.
                        noteEnrollLoss("server_unauthenticated@boot")
                        _state.value = SessionState.DeviceInvalid(cachedPerson())
                        return
                    }
                    else -> if (attempt < 2) delay(800)
                }
            }
        }
        // Transient failure persisted, but the token is intact and the device is
        // still enrolled. Resume the last known person (data revalidates on the
        // next call); if we never cached one, ask for the password rather than
        // forcing a whole re-enrollment.
        val cached = settings.currentCachedPerson()
            ?.let { runCatching { json.decodeFromString<PersonDto>(it) }.getOrNull() }
        _state.value =
            if (cached != null) SessionState.Ready(cached)
            else SessionState.NeedsReauth(null)
    }

    suspend fun loadNotifMeta(): com.kairos.app.data.remote.dto.NotifMetaDto =
        runAuthed { requireService().notifMeta() }

    suspend fun listSavedAddresses(): com.kairos.app.data.remote.dto.AddressesResponse =
        runAuthed { requireService().addresses() }

    suspend fun loadEventNames(): List<String> =
        runAuthed(clearOnUnauth = false) { requireService().eventNames() }.names

    suspend fun submitAddress(
        name: String,
        address: String,
        navByName: Boolean,
        force: Boolean,
    ): com.kairos.app.data.remote.dto.SubmitAddressResponse =
        runAuthed { requireService().submitAddress(com.kairos.app.data.remote.dto.SubmitAddressRequest(name, address, navByName, force)) }

    /** Background notification poll — non-nuking: a 401 here (e.g. at boot before
     *  the token is loaded) must not de-enroll the phone. */
    suspend fun loadUpcoming(): com.kairos.app.data.remote.dto.UpcomingDto =
        runAuthed(clearOnUnauth = false) { requireService().upcoming() }

    suspend fun loadClassForm(): com.kairos.app.data.remote.dto.ClassFormDto =
        runAuthed { requireService().classForm() }

    suspend fun createClass(body: com.kairos.app.data.remote.dto.CreateClassRequest) {
        runAuthed { requireService().createClass(body) }
    }

    suspend fun loadSchoolApprovals(): com.kairos.app.data.remote.dto.SchoolApprovalsDto =
        runAuthed { requireService().schoolApprovals() }

    suspend fun submitSchoolApproval(body: com.kairos.app.data.remote.dto.ApprovalActionRequest) {
        runAuthed { requireService().schoolApproval(body) }
    }

    /** Set my color (ring + calendar + everywhere it's used). Syncs to the web. */
    suspend fun setMyColor(color: String) {
        runAuthed { requireService().setColor(com.kairos.app.data.remote.dto.ColorRequest(color)) }
    }

    /** Upload a new avatar photo and/or re-frame it. Pass null bytes to only
     *  re-frame the existing photo. Syncs to the web. */
    suspend fun setAvatar(imageBytes: ByteArray?, mime: String?, position: String) {
        val posBody = position.toRequestBody("text/plain".toMediaType())
        val part = if (imageBytes != null && mime != null) {
            val ext = when (mime) {
                "image/png" -> "png"; "image/webp" -> "webp"; "image/gif" -> "gif"; else -> "jpg"
            }
            okhttp3.MultipartBody.Part.createFormData(
                "image", "avatar.$ext", imageBytes.toRequestBody(mime.toMediaType()),
            )
        } else {
            null
        }
        runAuthed { requireService().setAvatar(part, posBody) }
    }

    /** Re-fetch the enrolled person after a profile change so the drawer + ring
     *  reflect it. No-op if we're not in the Ready state or offline. */
    suspend fun refreshPerson() {
        val svc = service ?: return
        try {
            val person = apiCall { svc.me() }
            if (_state.value is SessionState.Ready) _state.value = SessionState.Ready(person)
        } catch (_: ApiException) {
        }
    }

    /** Validate a candidate server with the /meta handshake, and adopt it on
     *  success. Throws [ApiException] if it can't be reached or is too new. */
    suspend fun configureServer(rawBase: String) {
        val candidate = ApiClient.create(rawBase, httpCache, networkMonitor, writeQueue) { tokens.current() }
        val meta = apiCall { candidate.meta() }
        if (meta.minClient > CLIENT_BUILD) {
            throw ApiException(
                ApiError.Conflict("This server needs a newer app (build ${meta.minClient})."),
            )
        }
        settings.setBaseUrl(rawBase)
        rebuildService(rawBase)
        clearOfflineWrites() // writes queued against the old server must not replay here
        settings.clearLockedPerson()
        _state.value = SessionState.NeedsEnroll
    }

    /** Verify a password and hold the returned proof for the code step. */
    /** Ask the server to email a password-reset link. Always succeeds quietly —
     *  the server reveals nothing about whether the account exists. Needs the
     *  server configured. */
    suspend fun requestReset(identifier: String) {
        val svc = requireService()
        apiCall { svc.forgot(com.kairos.app.data.remote.dto.ForgotRequest(identifier.trim())) }
    }

    /** Whether a join token is valid, and if the account already has a password. */
    suspend fun joinCheck(token: String): com.kairos.app.data.remote.dto.JoinCheckResponse {
        val svc = requireService()
        return apiCall { svc.joinCheck(com.kairos.app.data.remote.dto.JoinCheckRequest(token.trim())) }
    }

    /** Redeem a join token: set/confirm the password and enroll this phone in one
     *  step, then go Ready. The unified onboarding path. */
    /** Self-service recovery: verify the account's own password server-side; on
     *  success the server emails a one-time join code, which the phone then
     *  redeems via [join]. Needs both the password and the account's email. */
    suspend fun startRecovery(identifier: String, password: String) {
        apiCall {
            requireService().recover(
                com.kairos.app.data.remote.dto.LoginRequest(identifier.trim(), password),
            )
        }
    }

    suspend fun join(token: String, password: String, deviceName: String?) {
        val svc = requireService()
        val res = apiCall {
            svc.join(
                com.kairos.app.data.remote.dto.JoinRequest(
                    token = token.trim(),
                    password = password,
                    deviceName = deviceName?.trim(),
                ),
            )
        }
        tokens.save(res.token)
        runCatching { httpCache?.evictAll() }
        clearOfflineWrites()
        settings.clearLockedPerson()
        _state.value = SessionState.Ready(res.person)
    }

    /** Sign out: best-effort server revoke, then wipe the local token. */
    /** "Log out" = lock, not un-enroll. Keep the device token (the phone stays
     *  enrolled) and remember who it's locked to, so getting back in needs only
     *  their username + password — no new code. A parent revoking the device in
     *  admin is the real removal, which forces a fresh code. */
    suspend fun signOut() {
        val person = (_state.value as? SessionState.Ready)?.person
        if (person != null) {
            settings.setLockedPerson(json.encodeToString(person))
            runCatching { httpCache?.evictAll() } // don't leave rendered data behind the lock
            _state.value = SessionState.Locked(person)
        } else {
            // No known person to lock to (unexpected state). NEVER revoke the
            // device or clear the token here — logout must only ever LOCK, so a
            // UI/state race can't turn "log out" into "unenroll this phone".
            // Resume from a cached person if we have one; otherwise drop to the
            // password/unlock screen with the enrollment fully intact.
            val cached = settings.currentCachedPerson()
                ?.let { runCatching { json.decodeFromString<PersonDto>(it) }.getOrNull() }
            runCatching { httpCache?.evictAll() }
            if (cached != null) {
                settings.setLockedPerson(json.encodeToString(cached))
                _state.value = SessionState.Locked(cached)
            } else {
                _state.value = SessionState.NeedsReauth(null)
            }
        }
    }

    /** Unlock a logged-out phone with the enrolled person's own username +
     *  password. Rejects a different account, so the phone stays theirs. */
    suspend fun unlock(identifier: String, password: String) {
        val svc = requireService()
        val res = apiCall { svc.login(LoginRequest(identifier.trim(), password)) }
        val p = res.person ?: throw ApiException(ApiError.Unknown("Couldn't sign in."))
        val locked = (_state.value as? SessionState.Locked)?.person
        if (locked != null && p.id != locked.id) {
            throw ApiException(
                ApiError.Forbidden(
                    "This phone is set up for ${locked.name}. Sign in with that " +
                        "account, or ask a parent for a new code.",
                ),
            )
        }
        settings.clearLockedPerson()
        _state.value = SessionState.Ready(p)
    }

    /** Change server entirely: revoke where possible, drop the token, and go
     *  back to setup so the user re-enrolls against the new host. */
    suspend fun changeServer() {
        val svc = service
        if (svc != null) {
            runCatching { apiCall { svc.revoke() } }
        }
        tokens.clear()
        clearOfflineWrites()
        runCatching { httpCache?.evictAll() }
        settings.clearBaseUrl()
        settings.clearLockedPerson()
        service = null
        baseUrlRaw = null
        _state.value = SessionState.NeedsSetup
    }

    /** Deliberately forget this device's stored credential and return to
     *  enrollment. This is the user explicitly choosing to start over from a
     *  DeviceInvalid screen; it is the only automatic-free path (besides a server
     *  change or a fresh enroll, which replaces the token) that destroys the
     *  token. */
    suspend fun forgetDevice() {
        tokens.clear()
        clearOfflineWrites()
        runCatching { httpCache?.evictAll() }
        settings.clearLockedPerson()
        _state.value = SessionState.NeedsEnroll
    }

    /** Load the day. A 401 here means the token died server-side, so we drop it
     *  and fall back to enrollment; the error is rethrown for the caller too. */
    suspend fun sportConfirm(eventId: String, dateISO: String?) {
        runAuthed { requireService().sportConfirm(com.kairos.app.data.remote.dto.SportAnswerRequest(eventId, dateISO)) }
    }

    suspend fun sportDecline(eventId: String, dateISO: String?) {
        runAuthed { requireService().sportDecline(com.kairos.app.data.remote.dto.SportAnswerRequest(eventId, dateISO)) }
    }

    suspend fun loadDashboard(date: String? = null): DashboardDto =
        runAuthed { requireService().dashboard(date) }

    suspend fun completeTask(id: String): TaskStatusDto =
        runAuthed { requireService().completeTask(id) }

    /** Complete a task from a notification action, which may run in a freshly
     *  woken process where the service/token aren't primed yet. Rebuilds and
     *  loads what it needs, then completes. Returns true on success. */
    suspend fun completeTaskFromNotification(id: String): Boolean {
        val base = settings.currentBaseUrl() ?: return false
        if (service == null) rebuildService(base)
        if (tokens.current() == null) tokens.load()
        val svc = service ?: return false
        val ok = runCatching { apiCall { svc.completeTask(id) } }.isSuccess
        if (ok) _tasksChanged.tryEmit(Unit)
        return ok
    }

    suspend fun uncompleteTask(id: String): TaskStatusDto =
        runAuthed { requireService().uncompleteTask(id) }

    suspend fun workoutComplete(date: String): WorkoutAckDto =
        runAuthed { requireService().workoutComplete(WorkoutDateRequest(date)) }

    suspend fun workoutUncomplete(date: String): WorkoutAckDto =
        runAuthed { requireService().workoutUncomplete(WorkoutDateRequest(date)) }

    suspend fun workoutRest(date: String): WorkoutAckDto =
        runAuthed { requireService().workoutRest(WorkoutDateRequest(date)) }

    suspend fun workoutExpire(date: String): WorkoutAckDto =
        runAuthed { requireService().workoutExpire(WorkoutDateRequest(date)) }

    suspend fun loadWorkout(date: String? = null): com.kairos.app.data.remote.dto.WorkoutPlanDto =
        runAuthed { requireService().workoutPlan(date) }

    suspend fun loadWorkoutProgress(): com.kairos.app.data.remote.dto.WorkoutProgressDto =
        runAuthed { requireService().workoutProgress() }

    suspend fun deleteWorkoutSession(id: String) {
        runAuthed { requireService().deleteWorkoutSession(id) }
    }

    suspend fun loadWorkoutPool(): com.kairos.app.data.remote.dto.WorkoutPoolDto =
        runAuthed { requireService().workoutPool() }

    suspend fun loadWeek(): List<com.kairos.app.data.remote.dto.WeeklyActivityDto> =
        runAuthed { requireService().workoutWeek() }.items

    suspend fun loadBrowse(): List<com.kairos.app.data.remote.dto.BrowseWorkoutDto> =
        runAuthed { requireService().workoutBrowse() }.items

    suspend fun loadWorkoutBuilder(): com.kairos.app.data.remote.dto.WorkoutBuilderDto =
        runAuthed { requireService().workoutBuilder() }

    suspend fun createPersonalWorkout(body: com.kairos.app.data.remote.dto.CreatePersonalWorkoutRequest) {
        runAuthed { requireService().createPersonalWorkout(body) }
    }

    suspend fun updatePersonalWorkout(body: com.kairos.app.data.remote.dto.UpdatePersonalWorkoutRequest) {
        runAuthed { requireService().updatePersonalWorkout(body) }
    }

    suspend fun shareWorkout(workoutId: String, targetUserId: String) {
        runAuthed { requireService().shareWorkout(com.kairos.app.data.remote.dto.ShareWorkoutRequest(workoutId, targetUserId)) }
    }

    suspend fun deletePersonalWorkout(workoutId: String) {
        runAuthed { requireService().deletePersonalWorkout(com.kairos.app.data.remote.dto.WorkoutIdRequest(workoutId)) }
    }

    suspend fun addMovement(category: String, name: String): String? =
        runAuthed { requireService().addMovement(com.kairos.app.data.remote.dto.AddMovementRequest(category, name)) }.id

    suspend fun renameMovement(movementId: String, name: String) {
        runAuthed { requireService().renameMovement(com.kairos.app.data.remote.dto.RenameMovementRequest(movementId, name)) }
    }

    suspend fun deleteMovement(movementId: String) {
        runAuthed { requireService().deleteMovement(com.kairos.app.data.remote.dto.MovementIdRequest(movementId)) }
    }

    suspend fun loadPlan(): com.kairos.app.data.remote.dto.PlanResponse =
        runAuthed { requireService().workoutPlan() }
    suspend fun setWeeklyStart(dateISO: String) {
        runAuthed { requireService().setWeeklyStart(com.kairos.app.data.remote.dto.AnchorRequest(dateISO)) }
    }
    suspend fun setWeeklyActive(active: Boolean) {
        runAuthed { requireService().setWeeklyActive(com.kairos.app.data.remote.dto.WeeklyActiveRequest(active)) }
    }

    suspend fun planMarkRest(day: Int) {
        runAuthed { requireService().planRest(com.kairos.app.data.remote.dto.PlanRestRequest(day)) }
    }

    suspend fun planCopyDay(from: Int, to: Int) {
        runAuthed { requireService().planCopy(com.kairos.app.data.remote.dto.PlanCopyRequest(from, to)) }
    }

    suspend fun planRemove(id: String) {
        runAuthed { requireService().planRemove(id) }
    }

    suspend fun loadPlanOptions(): com.kairos.app.data.remote.dto.PlanOptionsDto =
        runAuthed { requireService().planOptions() }

    suspend fun planAddPool(body: com.kairos.app.data.remote.dto.AddPoolRequest) {
        runAuthed { requireService().planAddPool(body) }
    }

    suspend fun planAddHiit(day: Int, hiitWorkoutId: String) {
        runAuthed { requireService().planAddHiit(com.kairos.app.data.remote.dto.AddHiitRequest(day, hiitWorkoutId)) }
    }

    suspend fun loadRotation(): com.kairos.app.data.remote.dto.RotationDto =
        runAuthed { requireService().rotation() }

    suspend fun rotationStart() { runAuthed { requireService().rotationStart() } }
    suspend fun rotationStop() { runAuthed { requireService().rotationStop() } }
    suspend fun rotationRestDays(mask: Int) {
        runAuthed { requireService().rotationRestDays(com.kairos.app.data.remote.dto.RestDaysRequest(mask)) }
    }
    suspend fun rotationAddSlot(body: com.kairos.app.data.remote.dto.AddSlotRequest) {
        runAuthed { requireService().rotationAddSlot(body) }
    }
    suspend fun rotationRemoveSlot(slotId: String) {
        runAuthed { requireService().rotationRemoveSlot(com.kairos.app.data.remote.dto.SlotIdRequest(slotId)) }
    }
    suspend fun rotationMoveSlot(slotId: String, dir: Int) {
        runAuthed { requireService().rotationMoveSlot(com.kairos.app.data.remote.dto.MoveSlotRequest(slotId, dir)) }
    }
    suspend fun rotationSetAnchor(dateISO: String) {
        runAuthed { requireService().rotationSetAnchor(com.kairos.app.data.remote.dto.AnchorRequest(dateISO)) }
    }

    suspend fun logCustom(body: com.kairos.app.data.remote.dto.CustomLogRequest): WorkoutAckDto =
        runAuthed { requireService().logCustom(body) }

    suspend fun logWorkout(
        date: String,
        plannedWorkoutId: String,
        entries: List<com.kairos.app.data.remote.dto.PlannedEntryDto>,
        replace: Boolean = false,
        detectConflict: Boolean = false,
    ): WorkoutAckDto =
        runAuthed {
            requireService().logWorkout(
                com.kairos.app.data.remote.dto.WorkoutLogRequest(
                    date, plannedWorkoutId, entries, replace, detectConflict,
                ),
            )
        }

    suspend fun loadReading(): com.kairos.app.data.remote.dto.ReadingDto =
        runAuthed { requireService().reading() }

    suspend fun loadChores(): com.kairos.app.data.remote.dto.ChoresDto =
        runAuthed { requireService().chores() }

    suspend fun loadCalendar(
        view: String?,
        date: String?,
    ): com.kairos.app.data.remote.dto.CalendarDto =
        runAuthed { requireService().calendar(view, date) }

    suspend fun saveCalendarPrefs(
        body: com.kairos.app.data.remote.dto.CalendarPrefsRequest,
    ) {
        runAuthed { requireService().saveCalendarPrefs(body) }
    }

    suspend fun setSubscribedReminders(eventId: String, reminders: List<Int>) {
        runAuthed {
            requireService().subscribedReminders(
                com.kairos.app.data.remote.dto.SubscribedRemindersRequest(eventId, reminders),
            )
        }
    }

    suspend fun createCalendarEvent(
        body: com.kairos.app.data.remote.dto.CreateEventRequest,
    ) {
        runAuthed { requireService().createEvent(body) }
    }

    suspend fun loadMoney(user: String?): com.kairos.app.data.remote.dto.MoneyDto =
        runAuthed { requireService().money(user) }

    suspend fun addMoneyEntry(body: com.kairos.app.data.remote.dto.AddMoneyRequest, clientId: String? = null): String? =
        runAuthed { requireService().addMoneyEntry(body.copy(clientId = clientId)) }.id

    suspend fun approveRewardMonth(periodKey: String) {
        runAuthed {
            requireService().approveRewardMonth(
                com.kairos.app.data.remote.dto.RewardApproveMonthRequest(periodKey),
            )
        }
    }

    suspend fun approveRewardBase(userId: String, periodKey: String) {
        runAuthed {
            requireService().approveRewardBase(
                com.kairos.app.data.remote.dto.RewardApproveBaseRequest(userId, periodKey),
            )
        }
    }

    suspend fun approveMoney(id: String) {
        runAuthed { requireService().approveMoney(com.kairos.app.data.remote.dto.MoneyIdRequest(id)) }
    }

    suspend fun unapproveMoney(id: String) {
        runAuthed { requireService().unapproveMoney(com.kairos.app.data.remote.dto.MoneyIdRequest(id)) }
    }

    suspend fun approveAllMoney() {
        runAuthed { requireService().approveAllMoney() }
    }

    suspend fun updateMoney(body: com.kairos.app.data.remote.dto.UpdateMoneyRequest) {
        runAuthed { requireService().updateMoney(body) }
    }

    suspend fun deleteMoney(id: String) {
        runAuthed { requireService().deleteMoney(com.kairos.app.data.remote.dto.MoneyIdRequest(id)) }
    }

    suspend fun setStartingFunds(body: com.kairos.app.data.remote.dto.StartingFundsRequest) {
        runAuthed { requireService().setStartingFunds(body) }
    }

    suspend fun loadBooks(): com.kairos.app.data.remote.dto.BooksDto =
        runAuthed { requireService().books() }

    suspend fun loadReadingGoals(): com.kairos.app.data.remote.dto.ReadingGoalsResponse =
        runAuthed { requireService().readingGoals() }

    suspend fun loadReadingReminder(): com.kairos.app.data.remote.dto.ReadingReminderDto =
        runAuthed { requireService().readingReminder() }

    suspend fun setReadingReminder(leadDays: Int): com.kairos.app.data.remote.dto.ReadingReminderDto =
        runAuthed { requireService().setReadingReminder(com.kairos.app.data.remote.dto.SetReadingReminderRequest(leadDays)) }

    suspend fun loadGameTime(): com.kairos.app.data.remote.dto.GameTimeResponseDto =
        runAuthed { requireService().gameTime() }

    suspend fun addBook(body: com.kairos.app.data.remote.dto.AddBookRequest, clientId: String? = null): String? =
        runAuthed { requireService().addBook(body.copy(clientId = clientId)) }.id

    suspend fun logBook(id: String, page: Int) {
        runAuthed { requireService().logBook(com.kairos.app.data.remote.dto.LogBookRequest(id, page)) }
    }

    suspend fun updateBook(body: com.kairos.app.data.remote.dto.UpdateBookRequest) {
        runAuthed { requireService().updateBook(body) }
    }

    suspend fun finishBook(id: String, finished: Boolean) {
        runAuthed { requireService().finishBook(com.kairos.app.data.remote.dto.BookFinishRequest(id, finished)) }
    }

    suspend fun shelfBook(id: String, shelved: Boolean) {
        runAuthed { requireService().shelfBook(com.kairos.app.data.remote.dto.BookShelfRequest(id, shelved)) }
    }

    suspend fun deleteBook(id: String) {
        runAuthed { requireService().deleteBook(com.kairos.app.data.remote.dto.BookIdRequest(id)) }
    }

    // ---- Groceries (shared family list) ----
    suspend fun loadGroceries(): com.kairos.app.data.remote.dto.GroceriesDto =
        runAuthed { requireService().groceries() }

    suspend fun addGrocery(name: String, storeId: String, note: String? = null, clientId: String? = null): String? =
        runAuthed { requireService().addGrocery(com.kairos.app.data.remote.dto.AddGroceryRequest(name, storeId, note, clientId)) }.id

    suspend fun addGroceryFromCatalog(catalogId: String, storeId: String? = null, clientId: String? = null): String? =
        runAuthed { requireService().addGroceryFromCatalog(com.kairos.app.data.remote.dto.AddCatalogRequest(catalogId, storeId, clientId)) }.id

    suspend fun removeGrocery(id: String) {
        runAuthed { requireService().removeGrocery(com.kairos.app.data.remote.dto.GroceryIdRequest(id)) }
    }

    suspend fun setGroceryPurchased(id: String, purchased: Boolean) {
        runAuthed { requireService().setGroceryPurchased(com.kairos.app.data.remote.dto.GroceryPurchasedRequest(id, purchased)) }
    }

    suspend fun startGroceryTrip(storeId: String, shopperId: String? = null): com.kairos.app.data.remote.dto.StartTripDto =
        runAuthed { requireService().startGroceryTrip(com.kairos.app.data.remote.dto.StartTripRequest(storeId, shopperId)) }

    suspend fun completeGroceryTrip(tripId: String) {
        runAuthed { requireService().completeGroceryTrip(com.kairos.app.data.remote.dto.CompleteTripRequest(tripId)) }
    }

    suspend fun moveGrocery(id: String, storeId: String) {
        runAuthed { requireService().moveGrocery(com.kairos.app.data.remote.dto.MoveGroceryRequest(id, storeId)) }
    }

    suspend fun loadCharacter(): com.kairos.app.data.remote.dto.CharacterDto =
        runAuthed { requireService().character() }

    suspend fun hatchCompanion(mode: String): com.kairos.app.data.remote.dto.HatchResultDto =
        runAuthed { requireService().hatchCompanion(com.kairos.app.data.remote.dto.HatchRequest(mode)) }

    suspend fun loadCollection(): com.kairos.app.data.remote.dto.CollectionDto =
        runAuthed { requireService().collection() }

    suspend fun loadCoop(): com.kairos.app.data.remote.dto.CoopDto =
        runAuthed { requireService().coop() }
    suspend fun proposeCoop(title: String, detail: String) {
        runAuthed { requireService().proposeCoop(com.kairos.app.data.remote.dto.ProposeCoopRequest(title, detail)) }
    }
    suspend fun voteCoop(proposalId: String) {
        runAuthed { requireService().voteCoop(com.kairos.app.data.remote.dto.CoopProposalIdRequest(proposalId)) }
    }
    suspend fun selectCoop(proposalId: String) {
        runAuthed { requireService().selectCoop(com.kairos.app.data.remote.dto.CoopProposalIdRequest(proposalId)) }
    }
    suspend fun grantCoop(proposalId: String) {
        runAuthed { requireService().grantCoop(com.kairos.app.data.remote.dto.CoopProposalIdRequest(proposalId)) }
    }
    suspend fun removeCoop(proposalId: String) {
        runAuthed { requireService().removeCoop(com.kairos.app.data.remote.dto.CoopProposalIdRequest(proposalId)) }
    }

    suspend fun loadSchool(term: String?): com.kairos.app.data.remote.dto.SchoolDto =
        runAuthed { requireService().school(term) }
    suspend fun addSchool(userId: String, title: String, type: String, dueDate: String, subject: String?, classId: String?, clientId: String? = null): String? =
        runAuthed { requireService().addSchool(com.kairos.app.data.remote.dto.AddSchoolRequest(userId, title, type, dueDate, subject, classId, clientId)) }.id
    suspend fun deleteSchool(taskId: String) {
        runAuthed { requireService().deleteSchool(com.kairos.app.data.remote.dto.SchoolTaskIdRequest(taskId)) }
    }
    suspend fun renameSchool(taskId: String, title: String) {
        runAuthed { requireService().renameSchool(com.kairos.app.data.remote.dto.SchoolRenameRequest(taskId, title)) }
    }
    suspend fun loadTasksList(): com.kairos.app.data.remote.dto.TasksListDto =
        runAuthed { requireService().tasksList() }
    suspend fun addTask(
        userId: String,
        title: String,
        dueDate: String?,
        recur: com.kairos.app.data.remote.dto.RecurRequest? = null,
        notifyMinutes: Int? = null,
        clientId: String? = null,
    ): String? =
        runAuthed { requireService().addTask(com.kairos.app.data.remote.dto.AddTaskRequest(userId, title, dueDate, recur, notifyMinutes, clientId)) }.id

    suspend fun loadTaskEdit(id: String): com.kairos.app.data.remote.dto.TaskEditDataDto =
        runAuthed { requireService().taskEditData(id) }

    suspend fun updateTask(
        id: String,
        userId: String,
        title: String,
        dueDate: String?,
        recur: com.kairos.app.data.remote.dto.RecurRequest? = null,
        notifyMinutes: Int? = null,
    ) {
        runAuthed {
            requireService().updateTask(
                id,
                com.kairos.app.data.remote.dto.AddTaskRequest(userId, title, dueDate, recur, notifyMinutes),
            )
        }
        _tasksChanged.tryEmit(Unit)
    }

    suspend fun deleteTask(id: String) {
        runAuthed { requireService().deleteTask(id) }
        _tasksChanged.tryEmit(Unit)
    }

    suspend fun deleteCalendarEvent(eventId: String, scope: String?, occurrenceISO: String?) {
        runAuthed {
            requireService().deleteEvent(
                com.kairos.app.data.remote.dto.DeleteEventRequest(eventId, scope, occurrenceISO),
            )
        }
    }

    suspend fun updateCalendarEvent(
        body: com.kairos.app.data.remote.dto.UpdateEventRequest,
    ) {
        runAuthed { requireService().updateEvent(body) }
    }

    suspend fun claimChore(taskId: String) {
        runAuthed {
            requireService().claimChore(
                com.kairos.app.data.remote.dto.ClaimChoreRequest(taskId),
            )
        }
    }

    suspend fun claimAndCompleteChore(taskId: String) {
        runAuthed {
            requireService().claimAndCompleteChore(
                com.kairos.app.data.remote.dto.ClaimChoreRequest(taskId),
            )
        }
    }

    suspend fun releaseChore(taskId: String) {
        runAuthed {
            requireService().releaseChore(
                com.kairos.app.data.remote.dto.ReleaseChoreRequest(taskId),
            )
        }
    }

    suspend fun completeAlwaysOpen(choreId: String) {
        runAuthed {
            requireService().completeAlwaysOpen(
                com.kairos.app.data.remote.dto.AlwaysOpenRequest(choreId),
            )
        }
    }

    suspend fun addSchoolToToday(taskId: String) {
        runAuthed {
            requireService().addSchoolToToday(
                com.kairos.app.data.remote.dto.AddToTodayRequest(taskId),
            )
        }
    }

    suspend fun previewReadingPlan(
        body: com.kairos.app.data.remote.dto.PersonalPlanRequest,
    ): com.kairos.app.data.remote.dto.PlanPreviewDto =
        runAuthed { requireService().previewReadingPlan(body) }

    suspend fun createReadingPlan(
        body: com.kairos.app.data.remote.dto.PersonalPlanRequest,
    ) {
        runAuthed { requireService().createReadingPlan(body) }
    }

    suspend fun deleteReadingPlan() {
        runAuthed { requireService().deleteReadingPlan() }
    }

    suspend fun markReading(passage: String, read: Boolean) {
        runAuthed {
            requireService().markReading(
                com.kairos.app.data.remote.dto.MarkReadingRequest(passage, read),
            )
        }
    }

    suspend fun saveReadingBook(bookName: String, chapters: List<Int>) {
        runAuthed {
            requireService().saveReadingBook(
                com.kairos.app.data.remote.dto.SaveBookRequest(bookName, chapters),
            )
        }
    }

    suspend fun saveReadingBooks(bookNames: List<String>, read: Boolean) {
        runAuthed {
            requireService().saveReadingBooks(
                com.kairos.app.data.remote.dto.SaveBooksRequest(bookNames, read),
            )
        }
    }

    suspend fun listDevices(): List<com.kairos.app.data.remote.dto.DeviceDto> =
        runAuthed { requireService().devices() }.devices

    suspend fun revokeDevice(id: String) {
        runAuthed { requireService().revokeDevice(id) }
    }

    private fun requireService() =
        service ?: throw ApiException(ApiError.Unknown("No server configured."))

    /** Live connectivity, so optimistic UI can skip the reload (which would read
     *  the stale offline cache and undo the optimistic change) while offline. */
    fun isOnline(): Boolean = networkMonitor?.isOnline() ?: true

    /** The writes still waiting to sync, so a screen can re-apply them on top of a
     *  (possibly cached) load and keep offline changes visible across navigation. */
    suspend fun pendingWrites(): List<com.kairos.app.data.remote.PendingWrite> =
        writeQueue?.snapshot() ?: emptyList()

    /** Discard any queued offline writes. Called whenever identity or server
     *  changes (sign-out, re-enroll, server switch, dead token) so one
     *  person's/server's pending writes can never replay under another. */
    private suspend fun clearOfflineWrites() {
        runCatching { writeQueue?.clear() }
    }

    /** The enrolled person's id, or null — so a screen can tell which queued
     *  writes belong to "me" (e.g. a task added for this device's person). */
    fun currentPersonId(): String? = (_state.value as? SessionState.Ready)?.person?.id

    private suspend fun <T> runAuthed(
        clearOnUnauth: Boolean = true,
        block: suspend () -> Response<T>,
    ): T {
        // #3 defensive invariant: never send an authenticated request without a
        // loaded credential. A tokenless request draws a "missing bearer" 401 that
        // historically wiped enrollment; if the token isn't loaded yet (cold-start
        // race), fail transiently here instead of sending it.
        if (tokens.current() == null) {
            throw ApiException(ApiError.Server("Session not ready - no credential loaded."))
        }
        try {
            return apiCall(block)
        } catch (e: ApiException) {
            when (e.error) {
                is ApiError.ReauthRequired ->
                    // Keep the device token; the app shows a password prompt.
                    _state.value = SessionState.NeedsReauth(null)
                is ApiError.Unauthenticated -> {
                    if (clearOnUnauth) {
                        // #5: before the drastic step of wiping enrollment, confirm
                        // the token is really dead with a deliberate /me check using
                        // the loaded credential. A spurious endpoint 401 (server
                        // hiccup) then can't strand a valid phone; only a second,
                        // positive "unauthenticated" clears it. 401s are rare, so
                        // this extra call is cheap and only runs on that path.
                        val confirmedDead = try {
                            apiCall { requireService().me() }
                            false
                        } catch (confirm: ApiException) {
                            confirm.error is ApiError.Unauthenticated
                        }
                        if (confirmedDead) {
                            noteEnrollLoss("server_unauthenticated@api (confirmed via /me)")
                            // Keep the token — a later validation can still recover it.
                            _state.value = SessionState.DeviceInvalid(
                                (_state.value as? SessionState.Ready)?.person ?: cachedPerson(),
                            )
                        }
                    }
                }
                else -> {}
            }
            throw e
        }
    }

    /** Re-confirm the password on an enrolled device whose account password
     *  changed. Keeps the same device token; on success returns to Ready. */
    suspend fun reauth(password: String) {
        val svc = requireService()
        val res = apiCall { svc.reauth(ReauthRequest(password)) }
        val person = res.person ?: apiCall { svc.me() }
        _state.value = SessionState.Ready(person)
    }

    suspend fun refreshMe() {
        val svc = service ?: return
        try {
            val person = apiCall { svc.me() }
            _state.value = SessionState.Ready(person)
        } catch (e: ApiException) {
            if (e.error is ApiError.Unauthenticated) {
                noteEnrollLoss("server_unauthenticated@refreshMe")
                // Keep the token — a later validation can still recover it.
                _state.value = SessionState.DeviceInvalid(
                    (_state.value as? SessionState.Ready)?.person ?: cachedPerson(),
                )
            }
        }
    }

    private companion object {
        /** This client's build number; compared against the server's minClient. */
        const val CLIENT_BUILD = 373
    }
}
