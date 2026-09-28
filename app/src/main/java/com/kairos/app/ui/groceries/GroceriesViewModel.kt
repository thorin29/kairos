package com.kairos.app.ui.groceries

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kairos.app.data.remote.ApiClient
import com.kairos.app.data.remote.ApiException
import com.kairos.app.data.remote.PendingWrite
import com.kairos.app.data.remote.dto.AddCatalogRequest
import com.kairos.app.data.remote.dto.AddGroceryRequest
import com.kairos.app.data.remote.dto.CompleteTripRequest
import com.kairos.app.data.remote.dto.GroceriesDto
import com.kairos.app.data.remote.dto.GroceryIdRequest
import com.kairos.app.data.remote.dto.GroceryLineDto
import com.kairos.app.data.remote.dto.GroceryPurchasedRequest
import com.kairos.app.data.remote.dto.MoveGroceryRequest
import com.kairos.app.data.session.SessionRepository
import com.kairos.app.data.local.PayloadCacheStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

data class GroceriesUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val data: GroceriesDto? = null,
    val busy: Boolean = false,
    val message: String? = null,
    val refreshing: Boolean = false,
)

/**
 * The shared family grocery list. One read (GET /groceries) returns the whole
 * board. Adds, removes, moves and tick-offs are optimistic and re-applied from the
 * offline queue on load, so they show at once, survive navigation/restart offline,
 * and reconcile on sync. Not self-only: anyone can add, shop, and tick things off.
 */
class GroceriesViewModel(
    private val session: SessionRepository,
    private val cache: PayloadCacheStore,
) : ViewModel() {

    private val _ui = MutableStateFlow(GroceriesUiState())
    val ui: StateFlow<GroceriesUiState> = _ui.asStateFlow()

    init { load() }

    fun load() {
        if (_ui.value.data == null) com.kairos.app.ui.common.ScreenSnapshots.groceries?.let { c -> _ui.update { it.copy(data = c) } }
        _ui.update { it.copy(loading = it.data == null, loadError = null) }
        viewModelScope.launch {
            val pid = session.currentPersonId() ?: PayloadCacheStore.HOUSEHOLD
            if (_ui.value.data == null) {
                runCatching { cache.readAs("groceries", "main", pid, com.kairos.app.data.remote.dto.GroceriesDto.serializer()) }
                    .getOrNull()?.let { applyPending(it, session.pendingWrites()) }
                    ?.let { d -> _ui.update { if (it.data == null) it.copy(data = d, loading = false) else it } }
            }
            try {
                val data = freshData()
                _ui.update { it.copy(loading = false, data = data) }
                com.kairos.app.ui.common.ScreenSnapshots.groceries = data
            } catch (e: ApiException) {
                _ui.update {
                    if (it.data == null) it.copy(loading = false, loadError = e.error.message)
                    else it.copy(loading = false)
                }
            }
        }
    }

    fun refresh() {
        _ui.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            try {
                val data = freshData()
                _ui.update { it.copy(refreshing = false, loading = false, loadError = null, data = data) }
                com.kairos.app.ui.common.ScreenSnapshots.groceries = data
            } catch (e: ApiException) {
                _ui.update { it.copy(refreshing = false, loadError = e.error.message) }
            }
        }
    }

    private suspend fun freshData(): GroceriesDto {
        // Fetch the RAW server DTO and cache it (raw, so the seed can re-apply
        // pending once). Every caller — load() and every mutation path — persists
        // through here, so a successful change keeps Room current.
        val raw = session.loadGroceries()
        viewModelScope.launch {
            runCatching { cache.writeAs("groceries", "main", session.currentPersonId() ?: PayloadCacheStore.HOUSEHOLD, com.kairos.app.data.remote.dto.GroceriesDto.serializer(), raw) }
        }
        return applyPending(raw, session.pendingWrites())
    }

    fun clearMessage() = _ui.update { it.copy(message = null) }

    fun add(name: String, storeId: String) {
        val clientId = UUID.randomUUID().toString()
        val tempId = "temp-$clientId"
        createLine({ insertLine(it, name, storeId, "", tempId) }, tempId) { session.addGrocery(name, storeId, null, clientId) }
    }
    fun addFromCatalog(catalogId: String, storeId: String?) {
        val clientId = UUID.randomUUID().toString()
        val tempId = "temp-$clientId"
        createLine({ insertFromCatalog(it, catalogId, storeId, tempId) }, tempId) { session.addGroceryFromCatalog(catalogId, storeId, clientId) }
    }
    fun remove(id: String) = optimistic({ removeLine(it, id) }) { session.removeGrocery(id) }
    fun move(id: String, storeId: String) = optimistic({ moveLine(it, id, storeId) }) { session.moveGrocery(id, storeId) }
    fun setPurchased(id: String, purchased: Boolean) =
        optimistic({ setPurchasedLine(it, id, purchased) }) { session.setGroceryPurchased(id, purchased) }
    fun completeTrip(tripId: String) =
        optimistic({ it.copy(trips = it.trips.filterNot { t -> t.id == tripId }) }) { session.completeGroceryTrip(tripId) }

    /** Start a run for a store: creates a trip server-side and navigates, so it's
     *  not optimistic — reloads to show the trip. */
    fun startTrip(storeId: String) {
        if (_ui.value.busy) return
        _ui.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            try {
                val res = session.startGroceryTrip(storeId, null)
                val msg = if (!res.ok && res.reason == "in-progress") "Someone's already shopping that store." else null
                _ui.update { it.copy(busy = false, message = msg) }
                load()
            } catch (e: ApiException) {
                _ui.update { it.copy(busy = false, loadError = e.error.message) }
            }
        }
    }

    private fun optimistic(mutate: (GroceriesDto) -> GroceriesDto, write: suspend () -> Unit) {
        if (_ui.value.busy) return
        val before = _ui.value.data ?: return
        val optimistic = mutate(before)
        _ui.update { it.copy(busy = true, message = null, data = optimistic) }
        viewModelScope.launch {
            try {
                write()
            } catch (e: ApiException) {
                _ui.update { it.copy(busy = false, data = before, loadError = e.error.message) }
                return@launch
            }
            try {
                val data = if (session.isOnline()) freshData() else _ui.value.data
                _ui.update { it.copy(busy = false, data = data) }
            } catch (e: ApiException) {
                _ui.update { it.copy(busy = false) }
                runCatching { cache.writeAs("groceries", "main", session.currentPersonId() ?: PayloadCacheStore.HOUSEHOLD, com.kairos.app.data.remote.dto.GroceriesDto.serializer(), optimistic.copy(saved = optimistic.saved.filterNot { it.id.startsWith("temp-") })) }
            }
        }
    }

    /** Create variant of [optimistic]: swaps the temp id for the server id the
     *  create returns, before the refresh, so a follow-up action targets the real
     *  id. Refresh-GET failure keeps and persists the real-id row; an old server
     *  that returns no id drops the still-temp row from screen and cache. */
    private fun createLine(
        mutate: (GroceriesDto) -> GroceriesDto,
        tempId: String,
        write: suspend () -> String?,
    ) {
        if (_ui.value.busy) return
        val before = _ui.value.data ?: return
        val optimistic = mutate(before)
        _ui.update { it.copy(busy = true, message = null, data = optimistic) }
        viewModelScope.launch {
            val realId = try {
                write()
            } catch (e: ApiException) {
                _ui.update { it.copy(busy = false, data = before, loadError = e.error.message) }
                return@launch
            }
            var eff = optimistic
            if (realId != null) {
                eff = optimistic.copy(saved = optimistic.saved.map { if (it.id == tempId) it.copy(id = realId) else it })
                _ui.update { if (it.data == optimistic) it.copy(data = eff) else it }
            }
            try {
                val data = if (session.isOnline()) freshData() else _ui.value.data
                _ui.update { it.copy(busy = false, data = data) }
            } catch (e: ApiException) {
                _ui.update { it.copy(busy = false) }
                val cleaned = eff.copy(saved = eff.saved.filterNot { it.id.startsWith("temp-") })
                if (realId == null) _ui.update { it.copy(data = cleaned) }
                runCatching { cache.writeAs("groceries", "main", session.currentPersonId() ?: PayloadCacheStore.HOUSEHOLD, com.kairos.app.data.remote.dto.GroceriesDto.serializer(), cleaned) }
            }
        }
    }

    // ---- transforms, also used to re-apply the offline queue on load ----

    private fun insertLine(data: GroceriesDto, name: String, storeId: String, icon: String, id: String = "temp-${UUID.randomUUID()}"): GroceriesDto =
        if (data.saved.any { it.id == id }) data
        else data.copy(saved = data.saved + GroceryLineDto(id = id, name = name, icon = icon, storeId = storeId))

    private fun insertFromCatalog(data: GroceriesDto, catalogId: String, storeId: String?, id: String = "temp-${UUID.randomUUID()}"): GroceriesDto {
        if (data.saved.any { it.id == id }) return data
        val c = data.catalog.firstOrNull { it.id == catalogId } ?: return data
        val sid = storeId ?: c.defaultStoreId ?: ""
        return data.copy(
            saved = data.saved + GroceryLineDto(id = id, name = c.name, icon = c.icon, storeId = sid),
        )
    }

    private fun removeLine(data: GroceriesDto, id: String): GroceriesDto =
        data.copy(
            saved = data.saved.filterNot { it.id == id },
            trips = data.trips.map { t -> t.copy(items = t.items.filterNot { it.id == id }) },
        )

    private fun moveLine(data: GroceriesDto, id: String, storeId: String): GroceriesDto =
        data.copy(saved = data.saved.map { if (it.id == id) it.copy(storeId = storeId) else it })

    private fun setPurchasedLine(data: GroceriesDto, id: String, purchased: Boolean): GroceriesDto =
        data.copy(
            saved = data.saved.map { if (it.id == id) it.copy(purchased = purchased) else it },
            trips = data.trips.map { t -> t.copy(items = t.items.map { if (it.id == id) it.copy(purchased = purchased) else it }) },
        )

    private fun <T> parse(body: String?, ser: kotlinx.serialization.KSerializer<T>): T? =
        body?.let { runCatching { ApiClient.json.decodeFromString(ser, it) }.getOrNull() }

    private fun applyPending(data: GroceriesDto, pending: List<PendingWrite>): GroceriesDto {
        var d = data
        for (w in pending) {
            when (w.url.substringAfter("/api/v1/", "")) {
                "groceries/add" -> parse(w.body, AddGroceryRequest.serializer())?.let { d = insertLine(d, it.name, it.storeId, "", "temp-${w.clientId ?: w.id}") }
                "groceries/add-catalog" -> parse(w.body, AddCatalogRequest.serializer())?.let { d = insertFromCatalog(d, it.catalogId, it.storeId, "temp-${w.clientId ?: w.id}") }
                "groceries/remove" -> parse(w.body, GroceryIdRequest.serializer())?.let { d = removeLine(d, it.id) }
                "groceries/move" -> parse(w.body, MoveGroceryRequest.serializer())?.let { d = moveLine(d, it.id, it.storeId) }
                "groceries/purchased" -> parse(w.body, GroceryPurchasedRequest.serializer())?.let { d = setPurchasedLine(d, it.id, it.purchased) }
                "groceries/trip/complete" -> parse(w.body, CompleteTripRequest.serializer())?.let { req -> d = d.copy(trips = d.trips.filterNot { it.id == req.tripId }) }
            }
        }
        return d
    }
}
