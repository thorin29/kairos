package com.kairos.app.ui.groceries

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import com.kairos.app.ui.theme.KairosThemeState
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kairos.app.data.remote.dto.GroceriesDto
import com.kairos.app.data.remote.dto.GroceryLineDto
import com.kairos.app.data.remote.dto.GroceryStoreDto
import com.kairos.app.data.remote.dto.GroceryTripDto
import com.kairos.app.ui.common.AnimatedDialog
import com.kairos.app.ui.common.LogoMenuButton
import com.kairos.app.ui.common.rememberContainer
import com.kairos.app.ui.nav.KairosIcons


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroceriesScreen(onOpenDrawer: () -> Unit, onAddItem: () -> Unit, meId: String, canDeleteAny: Boolean, refreshKey: Int = 0) {
    val container = rememberContainer()
    val vm: GroceriesViewModel = viewModel(
        factory = viewModelFactory { initializer { GroceriesViewModel(container.sessionRepository, container.payloadCache) } },
    )
    val ui by vm.ui.collectAsState()
    androidx.compose.runtime.LaunchedEffect(refreshKey) { if (refreshKey > 0) vm.load() }
    var editMode by remember { mutableStateOf(false) }

    val hasItems = ui.data?.let { d -> d.saved.isNotEmpty() || d.trips.any { it.items.isNotEmpty() } } ?: false
    if (!hasItems && editMode) editMode = false

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Groceries") },
                navigationIcon = { LogoMenuButton(onClick = onOpenDrawer) },
                actions = {
                    if (hasItems) {
                        if (editMode) {
                            TextButton(onClick = { editMode = false }) { Text("Done") }
                        } else {
                            IconButton(onClick = { editMode = true }) {
                                Icon(KairosIcons.Pencil, contentDescription = "Edit list", modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                },
            )
        },
    ) { inner ->
        Box(Modifier.padding(inner).fillMaxSize()) {
            PullToRefreshBox(
                isRefreshing = ui.refreshing,
                onRefresh = vm::refresh,
                modifier = Modifier.fillMaxSize(),
            ) {
            val data = ui.data
            when {
                ui.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(ui.loadError ?: "Couldn't load groceries.")
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = { vm.load() }) { Text("Retry") }
                    }
                }
                else -> GroceriesContent(vm, ui, data, onAddItem, editMode, meId, canDeleteAny)
            }
            }
        }
    }
}

@Composable
private fun GroceriesContent(vm: GroceriesViewModel, ui: GroceriesUiState, data: GroceriesDto, onAddItem: () -> Unit, editMode: Boolean, meId: String, canDeleteAny: Boolean) {
    var showShopPicker by remember { mutableStateOf(false) }
    var movingItem by remember { mutableStateOf<GroceryLineDto?>(null) }
    var deletingItem by remember { mutableStateOf<GroceryLineDto?>(null) }

    // You may remove items you added; parents and admins may remove anything.
    val canDelete: (GroceryLineDto) -> Boolean = { line ->
        val adderId = line.assignee?.id
        canDeleteAny || (adderId != null && adderId.isNotBlank() && adderId == meId)
    }

    val tripStoreIds = data.trips.map { it.storeId }.toSet()
    val storeById = data.stores.associateBy { it.id }
    val savedByStore = data.saved.groupBy { it.storeId }
    // Stores that have a saved list but no active trip.
    val savedStores = data.stores.filter { it.id in savedByStore && it.id !in tripStoreIds }
    // Stores you can start a run for (no run under way).
    val shoppableStores = data.stores.filter { it.id !in tripStoreIds }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PillButton("I'm going shopping", KairosIcons.Cart, filled = true, enabled = !ui.busy) {
                vm.clearMessage()
                showShopPicker = true
            }
            PillButton("Add item", KairosIcons.Plus, filled = false, enabled = !ui.busy) {
                vm.clearMessage()
                onAddItem()
            }
        }

        ui.message?.let { msg ->
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .clickable { vm.clearMessage() }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Text(msg, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        if (editMode) {
            Text(
                "Editing \u2014 change a store or remove items, then tap Done.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // Active shopping runs first.
        data.trips.forEach { trip ->
            val store = storeById[trip.storeId]
            if (store != null) {
                TripCard(
                    trip, store, ui.busy, vm, editMode,
                    canDelete = canDelete,
                    onDelete = { deletingItem = it },
                )
            }
        }

        // The saved list, grouped by store.
        savedStores.forEach { store ->
            SavedStoreCard(
                store, savedByStore[store.id].orEmpty(), ui.busy, editMode,
                canDelete = canDelete,
                onChangeStore = { movingItem = it },
                onDelete = { deletingItem = it },
            )
        }

        if (data.trips.isEmpty() && savedStores.isEmpty()) {
            Text(
                "The list is empty. Add something with \u201cAdd item\u201d.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    if (showShopPicker) {
        ShopPickerDialog(
            stores = shoppableStores,
            onPick = { storeId -> vm.startTrip(storeId); showShopPicker = false },
            onDismiss = { showShopPicker = false },
        )
    }

    movingItem?.let { item ->
        MoveStoreDialog(
            item = item,
            stores = data.stores,
            busy = ui.busy,
            onPick = { storeId -> vm.move(item.id, storeId); movingItem = null },
            onDismiss = { movingItem = null },
        )
    }

    deletingItem?.let { item ->
        DeleteConfirmDialog(
            item = item,
            busy = ui.busy,
            onConfirm = { vm.remove(item.id); deletingItem = null },
            onDismiss = { deletingItem = null },
        )
    }
}

@Composable
private fun DeleteConfirmDialog(item: GroceryLineDto, busy: Boolean, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AnimatedDialog(
        onDismissRequest = onDismiss,
        title = "Delete item?",
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        confirmButton = {
            TextButton(enabled = !busy, onClick = onConfirm) {
                Text("Delete", color = MaterialTheme.colorScheme.error)
            }
        },
    ) {
        Text("Remove \u201c${item.name}\u201d from the list?", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun TripCard(trip: GroceryTripDto, store: GroceryStoreDto, busy: Boolean, vm: GroceriesViewModel, editMode: Boolean, canDelete: (GroceryLineDto) -> Boolean, onDelete: (GroceryLineDto) -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${store.icon}  ${store.name}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text("${trip.got}/${trip.total}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            trip.shopper.name.takeIf { it.isNotBlank() }?.let {
                Text("Shopping: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(8.dp))
            ProgressBar(if (trip.total > 0) trip.got * 100 / trip.total else 0)
            Spacer(Modifier.height(10.dp))

            if (trip.items.isEmpty()) {
                Text("Nothing in the cart yet.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    trip.items.forEach { item ->
                        ItemRow(
                            item = item,
                            showTick = true,
                            busy = busy,
                            editMode = editMode,
                            canMove = false,
                            canDelete = canDelete(item),
                            onToggle = { vm.setPurchased(item.id, !item.purchased) },
                            onChangeStore = {},
                            onDelete = { onDelete(item) },
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(
                Modifier.clip(RoundedCornerShape(999.dp)).background(KairosThemeState.accent)
                    .clickable(enabled = !busy) { vm.completeTrip(trip.id) }
                    .padding(horizontal = 16.dp, vertical = 9.dp),
            ) { Text("Done shopping", style = MaterialTheme.typography.labelLarge, color = Color.White) }
        }
    }
}

@Composable
private fun SavedStoreCard(
    store: GroceryStoreDto,
    items: List<GroceryLineDto>,
    busy: Boolean,
    editMode: Boolean,
    canDelete: (GroceryLineDto) -> Boolean,
    onChangeStore: (GroceryLineDto) -> Unit,
    onDelete: (GroceryLineDto) -> Unit,
) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${store.icon}  ${store.name}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text("${items.size}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                items.forEach { item ->
                    ItemRow(
                        item = item,
                        showTick = false,
                        busy = busy,
                        editMode = editMode,
                        canMove = true,
                        canDelete = canDelete(item),
                        onToggle = {},
                        onChangeStore = { onChangeStore(item) },
                        onDelete = { onDelete(item) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ItemRow(
    item: GroceryLineDto,
    showTick: Boolean,
    busy: Boolean,
    editMode: Boolean,
    canMove: Boolean,
    canDelete: Boolean,
    onToggle: () -> Unit,
    onChangeStore: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth()
            .clickable(enabled = !busy && showTick && !editMode) { onToggle() }
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (showTick) {
            Box(
                Modifier.size(20.dp).clip(RoundedCornerShape(999.dp))
                    .border(2.dp, if (item.purchased) KairosThemeState.accent else MaterialTheme.colorScheme.outline, RoundedCornerShape(999.dp))
                    .background(if (item.purchased) KairosThemeState.accent else Color.Transparent),
            )
        }
        GroceryGlyph(item.icon, emojiStyle = MaterialTheme.typography.bodyLarge, size = 20.dp)
        Text(
            item.name,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textDecoration = if (item.purchased) TextDecoration.LineThrough else null,
            color = if (item.purchased) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
        )
        if (editMode) {
            if (canMove) {
                Box(Modifier.clip(RoundedCornerShape(999.dp)).clickable(enabled = !busy) { onChangeStore() }.padding(6.dp)) {
                    Icon(KairosIcons.Swap, contentDescription = "Change store", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                }
            }
            if (canDelete) {
                Box(Modifier.clip(RoundedCornerShape(999.dp)).clickable(enabled = !busy) { onDelete() }.padding(6.dp)) {
                    Icon(KairosIcons.Trash, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MoveStoreDialog(
    item: GroceryLineDto,
    stores: List<GroceryStoreDto>,
    busy: Boolean,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AnimatedDialog(
        onDismissRequest = onDismiss,
        title = "Move \u201c${item.name}\u201d to\u2026",
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            stores.forEach { store ->
                val selected = store.id == item.storeId
                Row(
                    Modifier.clip(RoundedCornerShape(999.dp))
                        .background(if (selected) KairosThemeState.accent else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(enabled = !busy) { onPick(store.id) }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(store.icon, style = MaterialTheme.typography.bodyMedium)
                    Text(store.name, style = MaterialTheme.typography.labelLarge, color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}

@Composable
private fun ShopPickerDialog(
    stores: List<GroceryStoreDto>,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AnimatedDialog(
        onDismissRequest = onDismiss,
        title = "Which store?",
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        if (stores.isEmpty()) {
            Text("Every store already has someone shopping it.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                stores.forEach { store ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                            .clickable { onPick(store.id) }
                            .padding(horizontal = 8.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(store.icon, style = MaterialTheme.typography.titleMedium)
                        Text(store.name, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}

// ---- building blocks ----

@Composable
private fun PillButton(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, filled: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(999.dp))
            .then(if (filled) Modifier.background(KairosThemeState.accent) else Modifier.border(1.dp, KairosThemeState.accent, RoundedCornerShape(999.dp)))
            .clickable(enabled = enabled) { onClick() }
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (filled) Color.White else KairosThemeState.accent, modifier = Modifier.size(18.dp))
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium, color = if (filled) Color.White else KairosThemeState.accent)
    }
}

@Composable
private fun ProgressBar(pct: Int) {
    Box(
        Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Box(
            Modifier.fillMaxWidth(fraction = (pct.coerceIn(0, 100)) / 100f)
                .height(8.dp).clip(RoundedCornerShape(999.dp)).background(KairosThemeState.accent),
        )
    }
}
