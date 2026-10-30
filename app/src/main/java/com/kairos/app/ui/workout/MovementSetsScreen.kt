package com.kairos.app.ui.workout

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.kairos.app.data.remote.dto.PoolExerciseDto
import com.kairos.app.ui.common.AnimatedDialog
import com.kairos.app.ui.common.rememberContainer
import com.kairos.app.ui.nav.KairosIcons
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** The same box width as the Log workout card's weight and reps fields. */
private val SET_FIELD_W = 72.dp

/**
 * One planned movement's sets for a day: the mockup's layout in the Log
 * workout card's style. The movement names itself with Swap beside it; each
 * set is a small card with the boxes labelled the way the old card did
 * ("165 lb × 3"), last time's numbers greyed inside them and never typed over.
 * ✓ saves a set, × removes one (a saved set asks first). Skip / Calculator /
 * Log stay along the bottom, above the system bar. Log and Back both keep
 * anything typed but not ticked.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MovementSetsScreen(
    date: String,
    plannedWorkoutId: String,
    slotId: String,
    name: String,
    metric: String,
    unit: String,
    late: Boolean,
    onDone: () -> Unit,
    onOpenCalculator: (String) -> Unit,
    usedWeight: String?,
    onWeightConsumed: () -> Unit,
) {
    val container = rememberContainer()
    val vm: MovementSetsViewModel = viewModel(
        key = "sets:$date:$plannedWorkoutId:$slotId",
        factory = viewModelFactory {
            initializer {
                MovementSetsViewModel(
                    session = container.sessionRepository,
                    date = date,
                    plannedWorkoutId = plannedWorkoutId,
                    slotId = slotId,
                    metric = metric,
                    unit = unit,
                    late = late,
                )
            }
        },
    )
    val ui by vm.ui.collectAsState()
    var swapping by remember { mutableStateOf(false) }

    LaunchedEffect(ui.done) { if (ui.done) onDone() }
    LaunchedEffect(usedWeight) {
        val w = usedWeight
        if (w != null) {
            vm.useWeight(w)
            onWeightConsumed()
        }
    }
    BackHandler { vm.leave() }

    val isWeight = metric == "WEIGHT"
    val swapped = ui.doingId != null && ui.doingId != slotId

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Log workout") },
                navigationIcon = {
                    IconButton(onClick = { vm.leave() }) {
                        Icon(KairosIcons.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        bottomBar = {
            if (!ui.loading) {
                Surface(color = MaterialTheme.colorScheme.surface) {
                    // Above the gesture bar, so rounded screen corners never
                    // clip the tiles.
                    Column(Modifier.navigationBarsPadding()) {
                        HorizontalDivider()
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            WorkoutActionTile(
                                icon = KairosIcons.Moon,
                                label = if (ui.skipped) "Skipped" else "Skip",
                                modifier = Modifier.weight(1f),
                                highlighted = !ui.skipped,
                                fixedHeight = 64.dp,
                            ) { vm.toggleSkip() }
                            WorkoutActionTile(
                                icon = KairosIcons.Dumbbell,
                                label = "Calculator",
                                modifier = Modifier.weight(1f),
                                highlighted = isWeight && !ui.skipped,
                                enabled = isWeight && !ui.skipped,
                                fixedHeight = 64.dp,
                            ) { onOpenCalculator("Use for set ${vm.nextUnsavedIndex()}") }
                            WorkoutActionTile(
                                icon = KairosIcons.Check,
                                label = "Log",
                                modifier = Modifier.weight(1f),
                                highlighted = !ui.skipped,
                                enabled = !ui.leaving,
                                loading = ui.leaving,
                                filled = true,
                                fixedHeight = 64.dp,
                            ) { vm.leave() }
                        }
                    }
                }
            }
        },
    ) { inner ->
        Box(Modifier.padding(inner).fillMaxSize()) {
            if (ui.loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MovementHeader(
                        name = if (swapped) ui.doingName ?: name else name,
                        insteadOf = if (swapped) name else null,
                        status = when {
                            ui.status.isNotBlank() -> ui.status
                            ui.lastDate != null -> "Last: ${shortDate(ui.lastDate!!)}"
                            else -> ""
                        },
                        late = if (late) "${dayName(date)} · logging late" else null,
                        showSwap = !ui.skipped,
                        onSwap = { vm.loadPool(); swapping = true },
                        onUndo = { vm.swapTo(null) },
                    )

                    ui.rows.forEachIndexed { i, r ->
                        SetCard(
                            index = i + 1,
                            row = r,
                            vm = vm,
                            metric = metric,
                            unit = unit,
                            sub = when {
                                r.added -> "Added today"
                                ui.lastSets.getOrNull(i) != null ->
                                    "Last time " + MovementSetsViewModel.fmtSet(ui.lastSets[i], metric)
                                else -> ""
                            },
                            enabled = !ui.skipped,
                        )
                    }

                    if (!ui.skipped) {
                        Row(
                            Modifier.padding(top = 2.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            PillButton(label = "Add set", icon = true) { vm.addSet() }
                            if (!vm.anyEntered() && vm.hasHints()) {
                                PillButton(label = "Same as last time", tinted = true) { vm.sameAsLast() }
                            }
                        }

                        val anyUnentered = ui.rows.any { !it.saved && it.w.isBlank() && it.hintW != null }
                        if (isWeight && anyUnentered) {
                            Row(
                                Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    "Remaining sets",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.weight(1f),
                                )
                                RoundStep("−${MovementSetsViewModel.fmt(vm.step)}") { vm.shiftBy(-vm.step) }
                                Text(
                                    when {
                                        ui.shift == 0.0 -> "0"
                                        ui.shift > 0 -> "+${MovementSetsViewModel.fmt(ui.shift)}"
                                        else -> "−${MovementSetsViewModel.fmt(-ui.shift)}"
                                    },
                                    style = MaterialTheme.typography.titleSmall,
                                    textAlign = TextAlign.Center,
                                    color = if (ui.shift == 0.0) MaterialTheme.colorScheme.onSurface
                                    else MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.widthIn(min = 36.dp),
                                )
                                RoundStep("+${MovementSetsViewModel.fmt(vm.step)}") { vm.shiftBy(vm.step) }
                            }
                        }
                    }
                }
            }
        }
    }

    ui.confirmKey?.let { key ->
        val i = ui.rows.indexOfFirst { it.key == key }
        val row = ui.rows.getOrNull(i)
        AlertDialog(
            onDismissRequest = { vm.keep() },
            title = { Text("Remove set ${i + 1}?") },
            text = { if (row != null) Text(MovementSetsViewModel.fmtSet(vm.valueOf(row), metric)) },
            confirmButton = {
                TextButton(onClick = { vm.remove(key) }) {
                    Text("Remove", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { vm.keep() }) { Text("Keep") } },
        )
    }

    if (swapping) {
        SetsSwapDialog(
            pool = ui.pool,
            slotId = slotId,
            title = "Swap $name",
            onPick = { vm.swapTo(it); swapping = false },
            onDismiss = { swapping = false },
        )
    }
}

/** The movement's name with Swap (or Undo) right after it — as on the Log
 *  workout card — and when it was last done, or the save status. */
@Composable
private fun MovementHeader(
    name: String,
    insteadOf: String?,
    status: String,
    late: String?,
    showSwap: Boolean,
    onSwap: () -> Unit,
    onUndo: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(bottom = 4.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                name,
                style = MaterialTheme.typography.titleLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (insteadOf != null) {
                SmallPill(label = "Undo", icon = false, onClick = onUndo)
            } else if (showSwap) {
                SmallPill(label = "Swap", icon = true, onClick = onSwap)
            }
            Spacer(Modifier.weight(1f))
            if (status.isNotBlank()) {
                Text(
                    status,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (status.startsWith("Not")) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (insteadOf != null) {
            Text(
                "instead of $insteadOf",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (late != null) {
            Text(late, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
        }
    }
}

/** One set: its number, "[165] lb × [3]", ✓ and ×, and last time's set. */
@Composable
private fun SetCard(
    index: Int,
    row: SetRow,
    vm: MovementSetsViewModel,
    metric: String,
    unit: String,
    sub: String,
    enabled: Boolean,
) {
    OutlinedCard(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (row.saved) MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
            else MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.padding(start = 10.dp, end = 4.dp, top = 8.dp, bottom = 6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    "$index",
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(18.dp),
                )
                when (metric) {
                    "WEIGHT" -> {
                        SetField(
                            value = row.w,
                            hint = vm.hintW(row)?.let { MovementSetsViewModel.fmt(it) } ?: "wt",
                            label = "Weight, set $index",
                            decimal = true,
                            enabled = enabled,
                        ) { vm.onWeight(row.key, it) }
                        UnitText(unit)
                        UnitText("×")
                        SetField(
                            value = row.r,
                            hint = row.hintR?.toString() ?: "rep",
                            label = "Reps, set $index",
                            decimal = false,
                            enabled = enabled,
                        ) { vm.onReps(row.key, it) }
                    }
                    "DURATION" -> {
                        SetField(
                            value = row.s,
                            hint = row.hintS?.toString() ?: "0",
                            label = "Seconds, set $index",
                            decimal = false,
                            enabled = enabled,
                        ) { vm.onSeconds(row.key, it) }
                        UnitText("sec")
                    }
                    else -> {
                        SetField(
                            value = row.r,
                            hint = row.hintR?.toString() ?: "0",
                            label = "Reps, set $index",
                            decimal = false,
                            enabled = enabled,
                        ) { vm.onReps(row.key, it) }
                        UnitText("reps")
                    }
                }
                Spacer(Modifier.weight(1f))
                // ✓ fills in once the set is saved.
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(if (row.saved) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
                        .border(
                            1.dp,
                            if (row.saved) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                            CircleShape,
                        )
                        .clickable(enabled = enabled) { vm.tick(row.key) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        KairosIcons.Check,
                        contentDescription = if (row.saved) "Undo set $index" else "Done: set $index",
                        tint = if (row.saved) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Box(
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(enabled = enabled) { vm.askRemove(row.key) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        KairosIcons.Close,
                        contentDescription = "Remove set $index",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            if (sub.isNotBlank()) {
                Text(
                    sub,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 24.dp),
                )
            }
        }
    }
}

@Composable
private fun UnitText(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/** The Log workout card's number box: same width, hint greyed inside. */
@Composable
private fun SetField(
    value: String,
    hint: String,
    label: String,
    decimal: Boolean,
    enabled: Boolean,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(hint, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)) },
        singleLine = true,
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number),
        modifier = Modifier
            .width(SET_FIELD_W)
            .semantics { contentDescription = label },
    )
}

/** −5 / +5 for the remaining sets: white circles, as in the mockup. */
@Composable
private fun RoundStep(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
    }
}

/** Add set / Same as last time: the Swap pill's shape, a size up. */
@Composable
private fun PillButton(label: String, icon: Boolean = false, tinted: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier
            .heightIn(min = 36.dp)
            .clip(shape)
            .background(
                if (tinted) MaterialTheme.colorScheme.primary.copy(alpha = 0.07f)
                else MaterialTheme.colorScheme.surface,
            )
            .border(
                1.dp,
                if (tinted) MaterialTheme.colorScheme.primary.copy(alpha = 0.35f) else MaterialTheme.colorScheme.outline,
                shape,
            )
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon) {
            Icon(KairosIcons.Plus, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(14.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (tinted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** The Log workout card's Swap pill. */
@Composable
private fun SmallPill(label: String, icon: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (icon) {
            Icon(KairosIcons.Swap, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
        }
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
    }
}

/** "2026-10-19" -> "Oct 19". */
private fun shortDate(iso: String): String = try {
    LocalDate.parse(iso).format(DateTimeFormatter.ofPattern("MMM d"))
} catch (_: Exception) {
    iso
}

/** "Thursday, October 29". */
private fun dayName(iso: String): String = try {
    LocalDate.parse(iso).format(DateTimeFormatter.ofPattern("EEEE, MMMM d"))
} catch (_: Exception) {
    iso
}

/** Same-category movements, by muscle group, with a search box — the log
 *  page's swap picker. */
@Composable
private fun SetsSwapDialog(
    pool: List<PoolExerciseDto>,
    slotId: String,
    title: String,
    onPick: (PoolExerciseDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val current = pool.firstOrNull { it.id == slotId }
    val q = query.trim().lowercase()
    val groups = remember(pool, q, current?.id) {
        pool.asSequence()
            .filter { it.id != slotId }
            .filter { current == null || it.category == current.category }
            .filter { q.isEmpty() || it.name.lowercase().contains(q) }
            .groupBy { it.muscleGroup }
            .map { (mg, items) ->
                val label = mg?.split('_')?.joinToString(" ") { it.lowercase() }?.replaceFirstChar { it.uppercase() } ?: "Other"
                Triple(mg == null, label, items.sortedBy { it.name.lowercase() })
            }
            .sortedWith(compareBy<Triple<Boolean, String, List<PoolExerciseDto>>> { it.first }.thenBy { it.second.lowercase() })
    }
    AnimatedDialog(
        onDismissRequest = onDismiss,
        title = title,
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search movements") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (groups.isEmpty()) {
                Text(
                    if (pool.isEmpty()) "Loading movements…" else "No movements match.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Column(Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState())) {
                    groups.forEach { (_, label, items) ->
                        Text(
                            label.uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 8.dp, top = 12.dp, bottom = 2.dp),
                        )
                        items.forEach { ex ->
                            Text(
                                ex.name,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { onPick(ex) }
                                    .padding(horizontal = 8.dp, vertical = 10.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
