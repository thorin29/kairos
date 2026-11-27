package com.kairos.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.collect
import com.kairos.app.data.remote.ApiException
import com.kairos.app.data.remote.ApiClient
import com.kairos.app.data.remote.dto.AddSchoolRequest
import com.kairos.app.data.remote.dto.AddTaskRequest
import com.kairos.app.data.remote.dto.TaskGroupDto
import java.time.LocalDate
import java.util.UUID
import com.kairos.app.data.remote.dto.AlwaysOpenRequest
import com.kairos.app.data.remote.dto.ClaimChoreRequest
import com.kairos.app.data.remote.dto.CreateEventRequest
import com.kairos.app.data.remote.dto.ScheduleItemDto
import com.kairos.app.data.remote.dto.DashboardDto
import com.kairos.app.data.remote.dto.WorkoutDateRequest
import com.kairos.app.data.remote.dto.MarkReadingRequest
import com.kairos.app.data.remote.dto.SportAnswerRequest
import com.kairos.app.data.remote.dto.TaskDto
import com.kairos.app.data.session.SessionRepository
import com.kairos.app.data.local.PayloadCacheStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val dashboard: DashboardDto? = null,
    /** Full-screen load error, shown only when there's nothing to display. */
    val loadError: String? = null,
    /** Transient error from a tap (e.g. a completion failed). */
    val actionError: String? = null,
    /** Task ids with an in-flight complete/uncomplete, for per-row spinners. */
    val busyIds: Set<String> = emptySet(),
    val signingOut: Boolean = false,
    /** Sport events just confirmed, asking how hard they were (v0.422). */
    val sportFeel: List<SportFeel> = emptyList(),
)

/** "How hard was hockey?" after Yes: the answer feeds the lighter-day suggestions. */
data class SportFeel(
    val eventId: String,
    val title: String,
    val dateISO: String,
    val effort: String? = null,
    val hurt: String? = null,
)

class HomeViewModel(
    private val session: SessionRepository,
    private val cache: PayloadCacheStore,
) : ViewModel() {

    private val _ui = MutableStateFlow(HomeUiState())
    val ui: StateFlow<HomeUiState> = _ui.asStateFlow()

    private fun personId(): String = session.currentPersonId() ?: PayloadCacheStore.HOUSEHOLD

    /** The phone's own date. Home is always a request for THIS day: the day is
     *  sent to the server explicitly and is the cache key, so a cached dashboard
     *  can never be served as a different day than the one it was built for. */
    private fun todayISO(): String = java.time.LocalDate.now().toString()
    private fun encodeDash(d: DashboardDto): String =
        ApiClient.json.encodeToString(DashboardDto.serializer(), d)
    private fun decodeDash(s: String): DashboardDto? =
        runCatching { ApiClient.json.decodeFromString(DashboardDto.serializer(), s) }.getOrNull()

    init {
        // Instant paint from the durable cache (survives a cold start) so Home
        // shows your last dashboard immediately instead of a spinner; load()
        // refreshes over it. Home is a single view — no date/tab — so this only
        // affects how fast it paints, never what it shows first.
        viewModelScope.launch {
            if (_ui.value.dashboard == null) {
                // Seed from TODAY's cache entry only. Reading a single "main" slot
                // is what let yesterday's dashboard paint as today's after a date
                // rollover; a missing entry for today must stay missing.
                val seed = runCatching { cache.read("home", todayISO(), personId()) }
                    .getOrNull()?.let { decodeDash(it) }?.let { applyPending(it) }
                if (seed != null) _ui.update {
                    if (it.dashboard == null) it.copy(dashboard = seed, loading = false) else it
                }
            }
        }
        viewModelScope.launch { session.tasksChanged.collect { refresh() } }
    }

    fun load() {
        _ui.update { it.copy(loading = it.dashboard == null, loadError = null) }
        // One load at a time (0.586.2): a refresh asked for while one is out
        // rides on it instead of racing it.
        if (loadJob?.isActive == true) return
        loadJob = viewModelScope.launch {
            try {
                val data = freshIfCurrent(null)
                _ui.update { it.copy(loading = false, refreshing = false, dashboard = data ?: it.dashboard, loadError = null) }
            } catch (e: ApiException) {
                // The fetch failed. If what's on screen is some OTHER day — the app
                // sat open across midnight, or this is a cold start seeded before
                // the date turned — fall back to the cached page for today, which
                // the background prefetch will usually have. Never leave a
                // different day sitting there as if it were today.
                val day = todayISO()
                val shown = _ui.value.dashboard
                if (shown == null || shown.date != day) {
                    val cached = runCatching { cache.read("home", day, personId()) }
                        .getOrNull()?.let { decodeDash(it) }?.let { applyPending(it) }
                    if (cached != null) {
                        _ui.update {
                            it.copy(loading = false, refreshing = false, dashboard = cached, loadError = null)
                        }
                        return@launch
                    }
                }
                _ui.update {
                    it.copy(
                        loading = false,
                        refreshing = false,
                        loadError = if (it.dashboard == null) {
                            "Today's page hasn't been loaded yet, and Kairos can't be reached. " +
                                "It'll load as soon as the server is back."
                        } else {
                            it.loadError
                        },
                        actionError = if (it.dashboard != null) e.error.message else null,
                    )
                }
            }
        }
    }

    private var loadJob: kotlinx.coroutines.Job? = null

    /** When a tap last started or finished (0.586.2). */
    @Volatile private var localChangeAt = 0L
    private fun touched() { localChangeAt = System.nanoTime() }

    /**
     * A fresh dashboard, or null when it may already be out of date (0.586.2):
     * another tap started or finished while it was being fetched, or one is
     * still saving. Before, a slow fetch that began before a tap came back
     * after it and put the old state back — the check appeared, then vanished,
     * and the next tap was ignored as still busy. [own] is the caller's own
     * busy key, which doesn't count. The screen keeps what it shows; the later
     * tap's own fetch brings the server's state.
     */
    private suspend fun freshIfCurrent(own: String?): DashboardDto? {
        val started = System.nanoTime()
        val data = freshDashboard()
        val othersBusy = _ui.value.busyIds.any { it != own }
        return if (localChangeAt > started || othersBusy) {
            if (_ui.value.dashboard == null) data else null
        } else {
            data
        }
    }

    /** Load the dashboard and re-apply any still-unsynced task completions, so a
     *  tick made offline stays put even after navigating away and back. */
    private suspend fun freshDashboard(): DashboardDto {
        // Fetch raw + cache it, so both load() and every post-action refresh keep
        // Room current (pending is re-applied on the seed).
        val day = todayISO()
        // Ask for the phone's day explicitly. Two things follow: the URL differs
        // per day, so OkHttp's disk cache can't answer an October request with a
        // September body; and the payload we store is unambiguously that day's.
        val raw = session.loadDashboard(day)
        viewModelScope.launch { runCatching { cache.write("home", day, personId(), encodeDash(raw)) } }
        return applyPending(raw)
    }

    /** Overlay the offline write queue onto a dashboard (fresh or cached), so an
     *  offline edit shows on the cold-start seed too, not only after a live fetch. */
    private suspend fun applyPending(dashboard: DashboardDto): DashboardDto {
        var d = dashboard
        val me = session.currentPersonId()
        for (w in session.pendingWrites()) {
            val path = w.url.substringAfter("/api/v1/", "")
            when {
                path == "tasks/add" -> {
                    val body = w.body ?: continue
                    val req = runCatching {
                        ApiClient.json.decodeFromString(AddTaskRequest.serializer(), body)
                    }.getOrNull() ?: continue
                    if (req.userId == me) d = insertDashTask(d, req.title, req.dueDate)
                }
                path == "school/add" -> {
                    val body = w.body ?: continue
                    val req = runCatching {
                        ApiClient.json.decodeFromString(AddSchoolRequest.serializer(), body)
                    }.getOrNull() ?: continue
                    if (req.userId == me) d = insertDashSchool(d, req.title, req.dueDate)
                }
                path.startsWith("tasks/") && path.endsWith("/complete") ->
                    d = mutateTaskStatus(d, path.removePrefix("tasks/").removeSuffix("/complete"), "COMPLETE")
                path.startsWith("tasks/") && path.endsWith("/uncomplete") ->
                    d = mutateTaskStatus(d, path.removePrefix("tasks/").removeSuffix("/uncomplete"), "PENDING")
                path == "chores/claim" -> {
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(ClaimChoreRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    d = d.copy(upForGrabs = d.upForGrabs.filterNot { it.id == req.taskId })
                }
                path == "chores/always-open" -> {
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(AlwaysOpenRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    d = bumpAlwaysOpen(d, req.choreId)
                }
                path == "sport/confirm" || path == "sport/decline" -> {
                    // The prompt was answered while the server was unreachable, so
                    // drop it from the cached day — otherwise "Did you go?" comes
                    // straight back on the next load and looks like the tap was lost.
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(SportAnswerRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    d = d.copy(sportPrompts = d.sportPrompts.filterNot { it.eventId == req.eventId })
                }
                path == "reading/mark" -> {
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(MarkReadingRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    d = d.copy(
                        personalReading = d.personalReading?.let {
                            if (it.passage == req.passage) it.copy(read = req.read) else it
                        },
                    )
                }
                path == "calendar/event" -> {
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(CreateEventRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    val mine = req.isFamily == true || req.participants == null || (me != null && req.participants!!.contains(me))
                    if (req.date == d.date && mine) d = insertDashSchedule(d, req)
                }
                path == "workouts/complete" || path == "workouts/rest" -> {
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(WorkoutDateRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    d = setWorkoutStatus(d, req.date, "COMPLETE")
                }
                path == "workouts/uncomplete" -> {
                    val req = w.body?.let {
                        runCatching { ApiClient.json.decodeFromString(WorkoutDateRequest.serializer(), it) }.getOrNull()
                    } ?: continue
                    d = setWorkoutStatus(d, req.date, "PENDING")
                }
            }
        }
        return d
    }

    /** Drop a queued-but-unsynced task into the dashboard's Tasks (OTHER) group. */
    private fun insertDashTask(dash: DashboardDto, title: String, dueDate: String?): DashboardDto {
        val due = dueDate ?: LocalDate.now().toString()
        val overdue = try { LocalDate.parse(due).isBefore(LocalDate.now()) } catch (_: Exception) { false }
        val task = TaskDto(
            id = "temp-${UUID.randomUUID()}",
            title = title,
            category = "OTHER",
            status = "PENDING",
            dueDate = due,
            completable = true,
            isOverdue = overdue,
        )
        return insertDashItem(dash, "OTHER", "Tasks", task)
    }

    /** Drop a queued-but-unsynced assignment into the dashboard's School group. */
    private fun insertDashSchool(dash: DashboardDto, title: String, dueDate: String): DashboardDto {
        val overdue = try { LocalDate.parse(dueDate).isBefore(LocalDate.now()) } catch (_: Exception) { false }
        val task = TaskDto(
            id = "temp-${UUID.randomUUID()}",
            title = title,
            category = "SCHOOL",
            status = "PENDING",
            dueDate = dueDate,
            completable = true,
            isOverdue = overdue,
        )
        return insertDashItem(dash, "SCHOOL", "School", task)
    }

    private fun insertDashItem(dash: DashboardDto, category: String, label: String, task: TaskDto): DashboardDto {
        val groups = dash.groups.toMutableList()
        val idx = groups.indexOfFirst { it.category == category }
        if (idx >= 0) {
            groups[idx] = groups[idx].copy(items = groups[idx].items + task)
        } else {
            groups.add(TaskGroupDto(category = category, label = label, items = listOf(task)))
        }
        return dash.copy(groups = groups)
    }

    /** Drop a queued-but-unsynced calendar event onto today's agenda. */
    private fun insertDashSchedule(dash: DashboardDto, req: CreateEventRequest): DashboardDto {
        val startMin = parseHHMM(req.start) ?: 0
        val item = ScheduleItemDto(
            title = req.title,
            allDay = req.allDay,
            timeLabel = if (req.allDay) "All day" else fmtTime(startMin),
            startMin = startMin,
            color = "#64748b",
            location = req.location,
        )
        return dash.copy(schedule = (dash.schedule + item).sortedBy { it.startMin })
    }

    private fun parseHHMM(s: String?): Int? {
        val parts = s?.split(":") ?: return null
        if (parts.size != 2) return null
        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        return h * 60 + m
    }

    private fun fmtTime(min: Int): String {
        val h = min / 60
        val m = min % 60
        val ampm = if (h < 12) "AM" else "PM"
        val h12 = ((h + 11) % 12) + 1
        return if (m == 0) "$h12 $ampm" else "%d:%02d %s".format(h12, m, ampm)
    }

    fun refresh() {
        _ui.update { it.copy(refreshing = true) }
        load()
    }

    /** Toggle a task with an optimistic flip: the row updates immediately, then
     *  we reload (online) to refresh the server-derived bars/percent, or keep the
     *  optimistic state (offline) until it syncs. Reverts on a real failure. */
    fun toggle(taskId: String, currentlyComplete: Boolean) {
        if (_ui.value.busyIds.contains(taskId)) return
        val before = _ui.value.dashboard
        val newStatus = if (currentlyComplete) "PENDING" else "COMPLETE"
        _ui.update {
            it.copy(
                busyIds = (it.busyIds + taskId).also { touched() },
                actionError = null,
                dashboard = it.dashboard?.let { d -> mutateTaskStatus(d, taskId, newStatus) },
            )
        }
        viewModelScope.launch {
            try {
                if (currentlyComplete) session.uncompleteTask(taskId)
                else session.completeTask(taskId)
                if (session.isOnline()) {
                    val data = freshIfCurrent(taskId)
                    _ui.update { it.copy(dashboard = data ?: it.dashboard, busyIds = (it.busyIds - taskId).also { touched() }) }
                } else {
                    _ui.update { it.copy(busyIds = (it.busyIds - taskId).also { touched() }) }
                }
            } catch (e: ApiException) {
                _ui.update {
                    it.copy(dashboard = before, busyIds = (it.busyIds - taskId).also { touched() }, actionError = e.error.message)
                }
            }
        }
    }

    private fun mutateTaskStatus(dash: DashboardDto, id: String, status: String): DashboardDto =
        dash.copy(
            overdue = dash.overdue.map { if (it.id == id) it.copy(status = status) else it },
            groups = dash.groups.map { g ->
                g.copy(items = g.items.map { if (it.id == id) it.copy(status = status) else it })
            },
        )

    /** Answer a "Did you do X?" sport prompt (yes/no), then reload. */
    fun answerSport(eventId: String, dateISO: String, done: Boolean) {
        val key = "sport-$eventId-$dateISO"
        if (_ui.value.busyIds.contains(key)) return
        _ui.update { it.copy(busyIds = (it.busyIds + key).also { touched() }, actionError = null) }
        // Answer for the occurrence the prompt is about (may be a carried-over
        // earlier day), falling back to the dashboard day.
        val date = if (dateISO.isNotBlank()) dateISO else _ui.value.dashboard?.date
        viewModelScope.launch {
            try {
                if (done) session.sportConfirm(eventId, date) else session.sportDecline(eventId, date)
                val title = _ui.value.dashboard?.sportPrompts?.firstOrNull { it.eventId == eventId }?.title.orEmpty()
                val data = freshIfCurrent(key)
                _ui.update {
                    it.copy(
                        dashboard = data ?: it.dashboard,
                        busyIds = (it.busyIds - key).also { touched() },
                        // Yes asks how hard it was; the check mark saves and
                        // clears it (v0.467, no Done step).
                        sportFeel = if (done && date != null) {
                            it.sportFeel + SportFeel(eventId = eventId, title = title, dateISO = date)
                        } else {
                            it.sportFeel
                        },
                    )
                }
            } catch (e: ApiException) {
                _ui.update { it.copy(busyIds = (it.busyIds - key).also { touched() }, actionError = e.error.message) }
            }
        }
    }

    /** How hard a confirmed sport event was (and anything that hurt). */
    fun sportFeedback(eventId: String, effort: String?, hurt: String?) {
        val f = _ui.value.sportFeel.firstOrNull { it.eventId == eventId } ?: return
        _ui.update { u -> u.copy(sportFeel = u.sportFeel.map { if (it.eventId == eventId) it.copy(effort = effort, hurt = hurt) else it }) }
        viewModelScope.launch {
            runCatching {
                session.saveFeedback(
                    com.kairos.app.data.remote.dto.FeedbackRequest(
                        date = f.dateISO,
                        slot = "sport:$eventId",
                        effort = effort,
                        hurt = hurt,
                    ),
                )
            }
        }
    }

    fun closeSportFeel(eventId: String) {
        _ui.update { u -> u.copy(sportFeel = u.sportFeel.filterNot { it.eventId == eventId }) }
    }

    /** Take an up-for-grabs chore for yourself AND complete it in one tap, then reload. */
    fun claimChore(taskId: String) {
        val key = "claim-$taskId"
        if (_ui.value.busyIds.contains(key)) return
        val before = _ui.value.dashboard
        _ui.update {
            it.copy(
                busyIds = (it.busyIds + key).also { touched() },
                actionError = null,
                dashboard = it.dashboard?.let { d -> d.copy(upForGrabs = d.upForGrabs.filterNot { g -> g.id == taskId }) },
            )
        }
        viewModelScope.launch {
            try {
                session.claimAndCompleteChore(taskId)
                if (session.isOnline()) {
                    freshIfCurrent(key).let { fresh -> _ui.update { it.copy(dashboard = fresh ?: it.dashboard, busyIds = (it.busyIds - key).also { touched() }) } }
                } else {
                    _ui.update { it.copy(busyIds = (it.busyIds - key).also { touched() }) }
                }
            } catch (e: ApiException) {
                _ui.update { it.copy(dashboard = before, busyIds = (it.busyIds - key).also { touched() }, actionError = e.error.message) }
            }
        }
    }

    /** Tap an always-open chore done for yourself, then reload. */
    fun completeAlwaysOpen(choreId: String) {
        val key = "always-$choreId"
        if (_ui.value.busyIds.contains(key)) return
        val before = _ui.value.dashboard
        _ui.update {
            it.copy(
                busyIds = (it.busyIds + key).also { touched() },
                actionError = null,
                dashboard = it.dashboard?.let { d -> bumpAlwaysOpen(d, choreId) },
            )
        }
        viewModelScope.launch {
            try {
                session.completeAlwaysOpen(choreId)
                if (session.isOnline()) {
                    freshIfCurrent(key).let { fresh -> _ui.update { it.copy(dashboard = fresh ?: it.dashboard, busyIds = (it.busyIds - key).also { touched() }) } }
                } else {
                    _ui.update { it.copy(busyIds = (it.busyIds - key).also { touched() }) }
                }
            } catch (e: ApiException) {
                _ui.update { it.copy(dashboard = before, busyIds = (it.busyIds - key).also { touched() }, actionError = e.error.message) }
            }
        }
    }

    /** "Do some extra work": pull an upcoming school lesson into today and let the
     *  server reschedule; then refresh so the get-ahead list advances. */
    fun addSchoolToToday(taskId: String) {
        val key = "add-$taskId"
        if (_ui.value.busyIds.contains(key)) return
        _ui.update { it.copy(busyIds = (it.busyIds + key).also { touched() }, actionError = null) }
        viewModelScope.launch {
            try {
                session.addSchoolToToday(taskId)
                freshIfCurrent(key).let { fresh -> _ui.update { it.copy(dashboard = fresh ?: it.dashboard, busyIds = (it.busyIds - key).also { touched() }) } }
            } catch (e: ApiException) {
                _ui.update { it.copy(busyIds = (it.busyIds - key).also { touched() }, actionError = e.error.message) }
            }
        }
    }

    /** Release a chore to the household pool (up for grabs). */
    fun releaseChore(taskId: String) {
        val key = "release-$taskId"
        if (_ui.value.busyIds.contains(key)) return
        _ui.update { it.copy(busyIds = (it.busyIds + key).also { touched() }, actionError = null) }
        viewModelScope.launch {
            try {
                session.releaseChore(taskId)
                freshIfCurrent(key).let { fresh -> _ui.update { it.copy(dashboard = fresh ?: it.dashboard, busyIds = (it.busyIds - key).also { touched() }) } }
            } catch (e: ApiException) {
                _ui.update { it.copy(busyIds = (it.busyIds - key).also { touched() }, actionError = e.error.message) }
            }
        }
    }

    private fun bumpAlwaysOpen(dash: DashboardDto, choreId: String): DashboardDto =
        dash.copy(alwaysOpen = dash.alwaysOpen.map { if (it.id == choreId) it.copy(myCount = it.myCount + 1) else it })

    fun clearActionError() {
        _ui.update { it.copy(actionError = null) }
    }

    /** Tick/untick the day's personal reading, then reload. Uses a sentinel busy
     *  id since it isn't a task row. */
    fun togglePersonalReading(passage: String, currentlyRead: Boolean) {
        val key = "personal-reading"
        if (_ui.value.busyIds.contains(key)) return
        val before = _ui.value.dashboard
        val newRead = !currentlyRead
        _ui.update {
            it.copy(
                busyIds = (it.busyIds + key).also { touched() },
                actionError = null,
                dashboard = it.dashboard?.let { d -> d.copy(personalReading = d.personalReading?.copy(read = newRead)) },
            )
        }
        viewModelScope.launch {
            try {
                session.markReading(passage, newRead)
                if (session.isOnline()) {
                    freshIfCurrent(key).let { fresh -> _ui.update { it.copy(dashboard = fresh ?: it.dashboard, busyIds = (it.busyIds - key).also { touched() }) } }
                } else {
                    _ui.update { it.copy(busyIds = (it.busyIds - key).also { touched() }) }
                }
            } catch (e: ApiException) {
                _ui.update { it.copy(dashboard = before, busyIds = (it.busyIds - key).also { touched() }, actionError = e.error.message) }
            }
        }
    }


    private fun setWorkoutStatus(dash: DashboardDto, date: String, status: String): DashboardDto =
        dash.copy(
            overdue = dash.overdue.map { if (it.isWorkout && it.dueDate == date) it.copy(status = status) else it },
            groups = dash.groups.map { g ->
                g.copy(items = g.items.map { if (it.isWorkout && it.dueDate == date) it.copy(status = status) else it })
            },
        )

    fun signOut() {
        _ui.update { it.copy(signingOut = true) }
        viewModelScope.launch { session.signOut() }
    }
}
