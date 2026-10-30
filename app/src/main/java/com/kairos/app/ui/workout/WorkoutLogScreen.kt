package com.kairos.app.ui.workout

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import com.kairos.app.data.remote.dto.PoolExerciseDto
import com.kairos.app.ui.common.AnimatedDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.height
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.material3.CircularProgressIndicator
import com.kairos.app.ui.nav.KairosIcons
import com.kairos.app.ui.theme.KairosThemeState
import kotlinx.coroutines.delay
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.compose.foundation.layout.size
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.kairos.app.ui.common.rememberContainer
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import androidx.compose.foundation.layout.widthIn

/** Three digits wide. Every numeric entry box on this screen uses it, so a
 *  weight, a rep count and a seconds field are never three different sizes. */
private val NUM_FIELD_W = 72.dp

/**
 * The Log workout page. Shows every planned workout for the day (Core, Arms) as
 * its own card with a value per movement and a Log button, a per-movement Skip
 * (do part, skip the rest), and an Expire action to close a missed workout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutLogScreen(
    date: String,
    onDone: () -> Unit,
    onOpenCalculator: () -> Unit,
    usedWeight: String?,
    onWeightConsumed: () -> Unit,
    onOpenSets: (com.kairos.app.ui.nav.Route.MovementSets) -> Unit = {},
    setsSaved: Boolean = false,
    onSetsConsumed: () -> Unit = {},
) {
    val container = rememberContainer()
    val vm: WorkoutLogViewModel = viewModel(
        factory = viewModelFactory {
            initializer { WorkoutLogViewModel(container.sessionRepository, date, container.payloadCache) }
        },
    )
    val ui by vm.ui.collectAsState()
    var showDatePicker by remember { mutableStateOf(false) }
    // Which card's movement launched the calculator, so its returned weight goes
    // to the right input.
    // Survives navigating to the calculator and back (a plain remember is wiped
    // when this screen is disposed), so the returned weight reaches the card it
    // came from.
    var pendingTarget by rememberSaveable(
        stateSaver = listSaver(
            save = { pair -> pair?.let { listOf(it.first, it.second) } ?: emptyList() },
            restore = { if (it.size == 2) it[0] to it[1] else null },
        ),
    ) { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(ui.done) { if (ui.done) onDone() }

    // Back from a movement's set logger: refresh its row.
    LaunchedEffect(setsSaved) {
        if (setsSaved) {
            vm.load()
            onSetsConsumed()
        }
    }

    LaunchedEffect(usedWeight) {
        val w = usedWeight
        val target = pendingTarget
        if (w != null && target != null) {
            vm.onValue(target.first, target.second, w)
            pendingTarget = null
            onWeightConsumed()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Log workout") },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(KairosIcons.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { inner ->
        Box(Modifier.padding(inner).fillMaxSize()) {
            when {
                ui.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                ui.loadError != null -> Text(
                    ui.loadError!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                )
                else -> Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    val overdueBlocks = ui.blocks.filter { it.isOverdue }
                    val todayBlocks = ui.blocks.filter { !it.isOverdue }
                    val openCalc: (String, String) -> Unit = { blockKey, exId ->
                        pendingTarget = blockKey to exId
                        onOpenCalculator()
                    }
                    val today = ui.strip?.today?.takeIf { it.isNotBlank() } ?: LocalDate.now().toString()
                    val openSets: (WorkoutBlock, MovementInput) -> Unit = { block, m ->
                        val day = block.date ?: ui.date ?: today
                        onOpenSets(
                            com.kairos.app.ui.nav.Route.MovementSets(
                                date = day,
                                plannedWorkoutId = block.plannedWorkoutId,
                                slotId = m.plannedExerciseId ?: m.poolExerciseId,
                                name = m.swappedFromName ?: m.name,
                                metric = m.metric,
                                unit = m.unit,
                                late = day < today,
                            ),
                        )
                    }

                    ui.date?.let { d ->
                        DayHeader(
                            date = d,
                            today = today,
                            title = ui.title.ifBlank { ui.planName ?: if (todayBlocks.isEmpty()) "Nothing planned" else "Workout" },
                            progress = dayProgress(todayBlocks),
                            strip = ui.strip,
                            onPickDate = { showDatePicker = true },
                            onPickDay = { vm.setDate(it) },
                        )
                    }

                    // Past days still open: the same sections, tinted, each
                    // labelled with its day.
                    overdueBlocks.groupBy { it.date ?: "" }.forEach { (d, blocks) ->
                        daySections(blocks).forEach { section ->
                            DaySectionView(
                                label = "${shortDay(d)} \u00b7 ${section.title}",
                                section = section,
                                overdue = true,
                                vm = vm,
                                onOpenCalculatorFor = openCalc,
                                onOpenSets = openSets,
                            )
                        }
                    }

                    if (todayBlocks.isNotEmpty()) {
                        daySections(todayBlocks).forEach { section ->
                            DaySectionView(
                                label = section.title,
                                section = section,
                                overdue = false,
                                vm = vm,
                                onOpenCalculatorFor = openCalc,
                                onOpenSets = openSets,
                            )
                        }
                    }

                    if (ui.actionError != null) {
                        Text(
                            ui.actionError!!,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }

                    HorizontalDivider(Modifier.padding(vertical = 8.dp))

                    ui.date?.let { d ->
                        CustomWorkoutForm(date = d, onLogged = onDone)
                    }
                }
            }
        }
    }

    val picking = ui.date
    if (showDatePicker && picking != null) {
        WorkoutDatePickerOverlay(
            dateIso = picking,
            onPick = { vm.setDate(it); showDatePicker = false },
            onDismiss = { showDatePicker = false },
        )
    }

    ui.conflict?.let { c ->
        AlertDialog(
            onDismissRequest = { vm.dismissConflict() },
            title = { Text("Already logged") },
            text = {
                Text(
                    "You already logged ${c.name} today: ${c.summary}. " +
                        "Update it with the new value, or cancel?",
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.confirmReplace() }) { Text("Update") }
            },
            dismissButton = {
                TextButton(onClick = { vm.dismissConflict() }) { Text("Cancel") }
            },
        )
    }
}

@Composable
internal fun WorkoutActionTile(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    highlighted: Boolean = false,
    enabled: Boolean = true,
    loading: Boolean = false,
    filled: Boolean = false,
    compact: Boolean = false,
    /** Overrides the tile's height (the set logger's bottom bar). */
    fixedHeight: androidx.compose.ui.unit.Dp? = null,
    onClick: () -> Unit,
) {
    val tileHeight = fixedHeight ?: if (compact) 56.dp else 84.dp
    // Icon/text color. A filled tile reads white on the system-color fill while
    // it's the primary action, then settles to the theme color once it greys out.
    // An outlined tile is the theme color while actionable and eases to grey after.
    val contentTarget = when {
        filled && highlighted -> MaterialTheme.colorScheme.onPrimary
        filled -> MaterialTheme.colorScheme.primary
        highlighted -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val tint by animateColorAsState(contentTarget, animationSpec = tween(700), label = "tileTint")
    if (filled) {
        // "Log weight": starts as the system color with a white icon/text, then
        // slowly fades to a greyed-out button carrying theme-color icon/text once
        // the block is logged. The fill is pinned across the disabled (saving)
        // state too, so the in-progress button doesn't flash grey.
        val containerTarget =
            if (highlighted) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.surfaceVariant
        val container by animateColorAsState(containerTarget, animationSpec = tween(700), label = "tileFill")
        Card(
            onClick = onClick,
            enabled = enabled,
            colors = CardDefaults.cardColors(
                containerColor = container,
                disabledContainerColor = container,
            ),
            modifier = modifier.height(tileHeight),
        ) { WorkoutActionTileBody(icon, label, tint, loading, compact) }
    } else {
        OutlinedCard(onClick = onClick, enabled = enabled, modifier = modifier.height(tileHeight)) {
            WorkoutActionTileBody(icon, label, tint, loading, compact)
        }
    }
}

@Composable
private fun WorkoutActionTileBody(
    icon: ImageVector,
    label: String,
    tint: Color,
    loading: Boolean,
    compact: Boolean = false,
) {
    val iconSize = if (compact) 16.dp else 22.dp
    Column(
        Modifier.fillMaxSize().padding(if (compact) 4.dp else 8.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(iconSize), strokeWidth = 2.dp, color = tint)
        } else {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(iconSize))
        }
        Spacer(Modifier.height(if (compact) 3.dp else 6.dp))
        Text(
            label,
            style = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelMedium,
            textAlign = TextAlign.Center,
            color = tint,
        )
    }
}

@Composable
private fun WorkoutBlockCard(
    block: WorkoutBlock,
    vm: WorkoutLogViewModel,
    onOpenCalculatorFor: (String, String) -> Unit,
) {
    // Overdue and today's cards are the same card. The only difference is the
    // background; they used to be two bodies with different button sizes and
    // wording, which made one screen look like two features.
    OutlinedCard(
        Modifier.fillMaxWidth(),
        colors = if (block.isOverdue) {
            CardDefaults.outlinedCardColors(
                containerColor = if (KairosThemeState.dark) Color(0xFF3A1A1E) else Color(0xFFFEF2F2),
            )
        } else {
            CardDefaults.outlinedCardColors()
        },
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            BlockBody(block, vm, onOpenCalculatorFor)
        }
    }
}

/** One muscle group's movements in the swap picker, under its own heading. */
private data class SwapGroup(
    val key: String,
    val label: String,
    val items: List<PoolExerciseDto>,
)

/** "UPPER_BACK" -> "Upper back". The server sends the enum name. */
private fun muscleLabel(raw: String): String =
    raw.split('_').joinToString(" ") { it.lowercase() }
        .replaceFirstChar { it.uppercase() }

/** The contents of a planned block: name, movements, and its own action row.
 *  Used both as a card of its own and stacked inside a shared muscle card. */
@Composable
private fun BlockBody(
    block: WorkoutBlock,
    vm: WorkoutLogViewModel,
    onOpenCalculatorFor: (String, String) -> Unit,
    hideName: Boolean = false,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (!hideName) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    block.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (block.logged) {
                    Icon(
                        KairosIcons.Check,
                        contentDescription = "Logged",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
            // No summary list of movement names here: each movement names
            // itself directly above its own entry field, and printing them
            // again under the muscle group said everything twice.
            HorizontalDivider()
            if (block.inputs.isEmpty()) {
                // Nothing to enter, so the buttons belong to the plan itself.
                BlockActions(block, vm, onOpenCalculatorFor)
            } else {
                // Every movement gets its own fields AND its own buttons, under
                // a rule of its own. Two movements added to one plan in a single
                // go now read exactly like two plans sharing a muscle group —
                // how they were added no longer changes how they are logged.
                block.inputs.forEachIndexed { i, m ->
                    if (i > 0) HorizontalDivider()
                    MovementRow(block.key, m, vm)
                    MovementActions(block, m, vm, onOpenCalculatorFor)
                }
            }
    }
}

/** One section of the day: "Chest", "Cardio"… and what's in it. */
private data class DaySectionUi(val key: String, val title: String, val blocks: List<WorkoutBlock>)

private val SECTION_ORDER = listOf("WARMUP", "CARDIO", "STRENGTH", "CONDITIONING", "SPORT", "OTHER")

/** Which section a plan belongs in, from its category — blocks.ts blockKind. */
private fun blockKind(b: WorkoutBlock): String = when (b.category) {
    "HIIT" -> "CONDITIONING"
    "ROWING", "RUNNING", "RUCKING" -> "CARDIO"
    "STRETCHING" -> "WARMUP"
    "SPORT" -> "SPORT"
    null, "WEIGHTS", "ISOMETRIC" -> "STRENGTH"
    else -> "OTHER"
}

private val KIND_TITLE = mapOf(
    "WARMUP" to "Warm-up",
    "CARDIO" to "Cardio",
    "CONDITIONING" to "Conditioning",
    "SPORT" to "Sport",
    "OTHER" to "Other",
)

/** The day's sections, in the web's order (blocks.ts daySections): strength
 *  by muscle group, two plans for the same group in one section. */
private fun daySections(blocks: List<WorkoutBlock>): List<DaySectionUi> {
    val seen = LinkedHashMap<String, Pair<String, DaySectionUi>>()
    blocks.forEach { b ->
        val kind = blockKind(b)
        val mg = b.muscleGroup?.takeIf { it.isNotBlank() }
        val key = when {
            kind != "STRENGTH" -> "k:$kind"
            mg != null -> "mg:$mg"
            else -> "w:${b.key}"
        }
        val title = when {
            kind != "STRENGTH" -> KIND_TITLE[kind] ?: b.name
            mg != null -> muscleLabel(mg)
            else -> b.name
        }
        val cur = seen[key]?.second
        seen[key] = kind to (
            if (cur != null) cur.copy(blocks = cur.blocks + b)
            else DaySectionUi(key = key, title = title, blocks = listOf(b))
            )
    }
    return SECTION_ORDER.flatMap { k -> seen.values.filter { it.first == k }.map { it.second } }
}

/** A strength plan whose every tracked movement is logged set by set — the
 *  same rule the web day page uses (blocks.ts daySections). */
internal fun opensSetLogger(b: WorkoutBlock): Boolean {
    val tracked = b.inputs.filter { it.tracked }
    return blockKind(b) == "STRENGTH" && tracked.isNotEmpty() &&
        tracked.all { it.metric == "WEIGHT" || it.metric == "REPS" || it.metric == "DURATION" }
}

private fun movementDone(m: MovementInput) = m.setCount > 0 || m.skipped || m.logged

/** Items done of items to do — blocks.ts dayProgress. */
private fun dayProgress(blocks: List<WorkoutBlock>): Pair<Int, Int> {
    var done = 0
    var total = 0
    blocks.forEach { b ->
        if (opensSetLogger(b)) {
            b.inputs.filter { it.tracked }.forEach { m ->
                total++
                if (movementDone(m)) done++
            }
        } else {
            total++
            if (b.logged) done++
        }
    }
    return done to total
}

/** "2026-10-29" -> "Thu 10/29". */
private fun shortDay(iso: String): String = try {
    val d = LocalDate.parse(iso)
    d.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.getDefault()) +
        " ${d.monthValue}/${d.dayOfMonth}"
} catch (_: Exception) {
    iso
}

/** "Today", or "Thursday, October 29". */
private fun dayLine(iso: String, today: String): String = if (iso == today) "Today" else try {
    LocalDate.parse(iso).format(DateTimeFormatter.ofPattern("EEEE, MMMM d"))
} catch (_: Exception) {
    iso
}

/** The page header: the day, what's being trained, how far through it is, and
 *  the last 8 days. Tapping the day opens the date picker. */
@Composable
private fun DayHeader(
    date: String,
    today: String,
    title: String,
    progress: Pair<Int, Int>,
    strip: com.kairos.app.data.remote.dto.WorkoutStripDto?,
    onPickDate: () -> Unit,
    onPickDay: (String) -> Unit,
) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onPickDate() }
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    KairosIcons.Calendar,
                    contentDescription = "Pick a day",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    dayLine(date, today) + if (date < today) " \u00b7 logging late" else "",
                    style = MaterialTheme.typography.labelLarge,
                    color = if (date < today) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            val (done, total) = progress
            if (total > 0) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LinearProgressIndicator(
                        progress = { done / total.toFloat() },
                        modifier = Modifier.weight(1f),
                        trackColor = MaterialTheme.colorScheme.surfaceVariant,
                    )
                    Text(
                        "$done of $total done",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            strip?.takeIf { it.days.isNotEmpty() }?.let {
                Spacer(Modifier.height(2.dp))
                WeekStrip(strip = it, selected = date, onPick = onPickDay)
            }
        }
    }
}

/** A section: its label, then a card per movement (strength) or per plan. */
@Composable
private fun DaySectionView(
    label: String,
    section: DaySectionUi,
    overdue: Boolean,
    vm: WorkoutLogViewModel,
    onOpenCalculatorFor: (String, String) -> Unit,
    onOpenSets: (WorkoutBlock, MovementInput) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            label.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            letterSpacing = androidx.compose.ui.unit.TextUnit(0.08f, androidx.compose.ui.unit.TextUnitType.Em),
            color = if (overdue) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp, start = 2.dp),
        )
        section.blocks.forEach { block ->
            if (opensSetLogger(block)) {
                block.inputs.forEach { m ->
                    MovementCard(
                        m = m,
                        overdue = overdue,
                        onOpen = if (m.tracked) ({ onOpenSets(block, m) }) else null,
                    )
                }
            } else {
                WorkoutBlockCard(block, vm, onOpenCalculatorFor)
            }
        }
    }
}

private fun overdueTint(): Color = if (KairosThemeState.dark) Color(0xFF3A1A1E) else Color(0xFFFEF2F2)

/** One movement on the day page: name, today's sets or last time's, a Logged /
 *  Skipped chip, and a chevron into its set logger. */
@Composable
private fun MovementCard(m: MovementInput, overdue: Boolean, onOpen: (() -> Unit)?) {
    val logged = m.setCount > 0 || (m.logged && !m.skipped)
    val skipped = m.skipped && !logged
    val planned = m.swappedFromName ?: m.name
    val detail = when {
        onOpen == null -> "No log needed"
        logged -> (if (m.swappedFromName != null) "${m.name} \u00b7 " else "") + m.summary.ifBlank { "Logged" }
        skipped -> "Skipped today"
        m.last.isNotBlank() -> "Last time ${m.last}"
        else -> "Not logged yet"
    }
    val colors = if (overdue) CardDefaults.outlinedCardColors(containerColor = overdueTint())
    else CardDefaults.outlinedCardColors()
    val body: @Composable () -> Unit = {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    planned,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    detail,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (logged) StatusChip("Logged", positive = true)
            if (skipped) StatusChip("Skipped", positive = false)
            if (onOpen != null) {
                Icon(
                    KairosIcons.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
    if (onOpen != null) {
        OutlinedCard(onClick = onOpen, modifier = Modifier.fillMaxWidth(), colors = colors) { body() }
    } else {
        OutlinedCard(modifier = Modifier.fillMaxWidth(), colors = colors) { body() }
    }
}

/** Logged (green) / Skipped (grey), as on the web day page. */
@Composable
internal fun StatusChip(label: String, positive: Boolean) {
    val bg = when {
        positive && KairosThemeState.dark -> Color(0xFF0F2E25)
        positive -> Color(0xFFECFDF5)
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val fg = when {
        positive && KairosThemeState.dark -> Color(0xFF6EE7B7)
        positive -> Color(0xFF047857)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = fg,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 9.dp, vertical = 3.dp),
    )
}

/** The last 8 days: tap one to log it. Done, part-done, rest, open and
 *  expired days read the same as on the web. */
@Composable
private fun WeekStrip(
    strip: com.kairos.app.data.remote.dto.WorkoutStripDto,
    selected: String?,
    onPick: (String) -> Unit,
) {
    val overdue = strip.overdue.toSet()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        strip.days.forEach { d ->
            val state = stripState(d, strip.today, overdue)
            val isSel = d.date == selected
            val dow = runCatching {
                LocalDate.parse(d.date).dayOfWeek
                    .getDisplayName(java.time.format.TextStyle.NARROW, java.util.Locale.getDefault())
            }.getOrDefault("")
            val num = d.date.takeLast(2).trimStart('0')
            val fill = when (state) {
                "done" -> MaterialTheme.colorScheme.primary
                "partial" -> MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
                "open" -> MaterialTheme.colorScheme.error.copy(alpha = 0.15f)
                else -> Color.Transparent
            }
            val fg = when (state) {
                "done" -> MaterialTheme.colorScheme.onPrimary
                "expired", "none" -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                "open" -> MaterialTheme.colorScheme.error
                else -> MaterialTheme.colorScheme.onSurface
            }
            Column(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (isSel) MaterialTheme.colorScheme.primary.copy(alpha = 0.08f) else Color.Transparent,
                    )
                    .then(if (state != "expired") Modifier.clickable { onPick(d.date) } else Modifier)
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(dow, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(fill)
                        .border(
                            if (isSel) 1.5.dp else 0.dp,
                            if (isSel) MaterialTheme.colorScheme.primary else Color.Transparent,
                            RoundedCornerShape(14.dp),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (state == "rest") {
                        Icon(KairosIcons.Moon, contentDescription = "Rest", tint = fg, modifier = Modifier.size(14.dp))
                    } else {
                        Text(
                            num,
                            style = MaterialTheme.typography.labelMedium,
                            color = fg,
                            fontWeight = if (isSel || state == "today") FontWeight.Bold else FontWeight.Normal,
                        )
                    }
                }
            }
        }
    }
}

/** One strip day's look — mirrors blocks.ts stripState. */
private fun stripState(
    d: com.kairos.app.data.remote.dto.WorkoutStripDayDto,
    today: String,
    overdue: Set<String>,
): String = when {
    d.rested -> "rest"
    d.task == "COMPLETE" -> "done"
    d.task == "SKIPPED" -> if (d.logged) "done" else "rest"
    d.task == "PENDING" -> when {
        d.date == today -> if (d.logged) "partial" else "today"
        d.date in overdue -> if (d.logged) "partial" else "open"
        else -> if (d.logged) "partial" else "expired"
    }
    d.logged -> "done"
    d.date == today -> "today"
    else -> "none"
}

/** One movement's three tiles: skip it, open the calculator for it, log it. */
@Composable
private fun MovementActions(
    block: WorkoutBlock,
    m: MovementInput,
    vm: WorkoutLogViewModel,
    onOpenCalculatorFor: (String, String) -> Unit,
) {
    // After a log, flash "logged" briefly, then settle on "edit weight". Keyed
    // on the save counter rather than on `logged`, so a movement that arrives
    // already recorded doesn't flash every time the page opens.
    var justLogged by remember(block.key, m.poolExerciseId) { mutableStateOf(false) }
    LaunchedEffect(m.savedAt) {
        if (m.savedAt > 0) {
            justLogged = true
            delay(2500)
            justLogged = false
        } else {
            // A reload resets the counter; don't leave a half-finished flash on.
            justLogged = false
        }
    }
    val noun = logNoun(listOf(m))
    val logLabel = when {
        justLogged -> "logged"
        m.logged -> "edit $noun"
        else -> "Log $noun"
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        WorkoutActionTile(
            icon = KairosIcons.Moon,
            label = if (m.skipped) "Skipped" else "Skip",
            modifier = Modifier.weight(1f),
            highlighted = !m.skipped,
        ) {
            // Skips THIS movement for its day, on the server — overdue days
            // included, since the block carries its own date. Once every
            // movement is logged or skipped the day is done.
            vm.setMovementSkipped(block.key, m.poolExerciseId, !m.skipped)
        }
        WorkoutActionTile(
            icon = KairosIcons.Dumbbell,
            label = "Calculator",
            modifier = Modifier.weight(1f),
            highlighted = true,
        ) {
            // THIS movement, not the card's first one — the calculator used to
            // hand its result back to the top movement whichever button opened
            // it, so a second movement's weight landed in the wrong box.
            onOpenCalculatorFor(block.key, m.poolExerciseId)
        }
        WorkoutActionTile(
            icon = KairosIcons.Dumbbell,
            label = logLabel,
            modifier = Modifier.weight(1f),
            highlighted = !m.logged,
            enabled = !m.saving,
            loading = m.saving,
            filled = true,
        ) { vm.saveBlock(block.key, m.poolExerciseId) }
    }
}

/** The tiles for a plan with no movements to enter — the one shape that still
 *  has nothing to hang per-movement buttons on. */
@Composable
private fun BlockActions(
    block: WorkoutBlock,
    vm: WorkoutLogViewModel,
    onOpenCalculatorFor: (String, String) -> Unit,
) {
    var justLogged by remember(block.key) { mutableStateOf(false) }
    LaunchedEffect(block.logged) {
        if (block.logged) {
            justLogged = true
            delay(2500)
            justLogged = false
        } else {
            justLogged = false
        }
    }
    val blockSkipped = block.inputs.isNotEmpty() && block.inputs.all { it.skipped }
    val logLabel = when {
        block.logged && justLogged -> "logged"
        block.logged -> "edit weight"
        else -> "Log weight"
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        WorkoutActionTile(
            icon = KairosIcons.Moon,
            label = if (blockSkipped) "Skipped" else "Skip",
            modifier = Modifier.weight(1f),
            highlighted = !blockSkipped,
        ) {
            vm.setBlockSkipped(block.key, !blockSkipped)
        }
        WorkoutActionTile(
            icon = KairosIcons.Dumbbell,
            label = "Calculator",
            modifier = Modifier.weight(1f),
            highlighted = true,
        ) { onOpenCalculatorFor(block.key, "") }
        WorkoutActionTile(
            icon = KairosIcons.Dumbbell,
            label = logLabel,
            modifier = Modifier.weight(1f),
            highlighted = !block.logged,
            enabled = !block.saving,
            loading = block.saving,
            filled = true,
        ) { vm.saveBlock(block.key) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkoutDatePickerOverlay(
    dateIso: String,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val state = rememberDatePickerState(initialSelectedDateMillis = isoToUtcMillis(dateIso))
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                state.selectedDateMillis?.let { onPick(utcMillisToIso(it)) }
            }) { Text("OK") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) { DatePicker(state = state) }
}

private fun isoToUtcMillis(iso: String): Long =
    try {
        LocalDate.parse(iso, DateTimeFormatter.ISO_DATE)
            .atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    } catch (_: Exception) {
        Instant.now().toEpochMilli()
    }

private fun utcMillisToIso(millis: Long): String =
    Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
        .format(DateTimeFormatter.ISO_DATE)

@Composable
private fun MovementRow(planId: String, m: MovementInput, vm: WorkoutLogViewModel) {
    val maxHint = m.metric == "WEIGHT"
    val isTime = m.metric == "DURATION"
    var swapping by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        // The movement always names itself, with its swap control on the same
        // line — the muscle group heads the card and no longer repeats these
        // names, so this row is the only place the movement is named.
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // The name gets a fixed column and the swap pill sits right after
            // it, so the pill lands in the same place on every card. Giving the
            // name weight(1f) instead pushed the pill to the far edge and moved
            // it with every change of movement name.
            Text(
                m.name,
                style = MaterialTheme.typography.bodyMedium,
                color = if (m.skipped) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                textDecoration = if (m.skipped) TextDecoration.LineThrough else null,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                // Takes only the width it needs, so Swap sits against the end
                // of the name. A fixed 150dp column parked the button at the
                // same x whatever the name was, leaving it hanging over empty
                // space next to anything short. `fill = false` keeps the bound
                // for a long name — it ellipsizes rather than pushing Swap off.
                modifier = Modifier.weight(1f, fill = false),
            )
            // Swap this movement for a variation TODAY only — front squat for back
            // squat. The weekly plan is untouched; next week comes back as planned.
            if (!m.skipped) {
                if (m.swappedFromName != null) {
                    Text(
                        "Undo",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
                            .clickable { vm.undoSwap(planId, m.poolExerciseId) }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                } else {
                    // An outlined pill, not a bare word: the first version was a
                    // plain label and nobody could tell it was tappable.
                    Row(
                        Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .border(
                                1.dp,
                                MaterialTheme.colorScheme.outline,
                                RoundedCornerShape(14.dp),
                            )
                            .clickable { vm.loadPool(); swapping = true }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Icon(
                            KairosIcons.Swap,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            "Swap",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
            Spacer(Modifier.weight(1f))
        }
        if (!m.skipped) {
            if (m.swappedFromName != null) {
                Text(
                    "instead of ${m.swappedFromName}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // The fields sit in the SAME three weighted cells as the action
            // tiles below, so the weight box lands over "Rest / skip" and reps
            // over "Calculator" instead of drifting to opposite ends of the row.
            // Each box is capped at three digits wide and allowed to shrink
            // below that on a narrow screen rather than overflow its cell.
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Cell 1 — over "Rest / skip".
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = m.value,
                        onValueChange = { vm.onValue(planId, m.poolExerciseId, it) },
                        placeholder = { Text(if (isTime) "0" else if (maxHint) "wt" else "0") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f, fill = false).widthIn(max = NUM_FIELD_W),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (isTime) "min" else m.unit,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                // Cell 2 — over "Calculator". Seconds for a held movement, reps
                // for a weight, and empty for anything else.
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    if (isTime) {
                        OutlinedTextField(
                            value = m.seconds,
                            onValueChange = { vm.onSeconds(planId, m.poolExerciseId, it) },
                            placeholder = { Text("00") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f, fill = false).widthIn(max = NUM_FIELD_W),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "sec",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else if (maxHint) {
                        // Reps for the top set. Optional, and only for weights:
                        // without it 185 x 5 and 185 x 12 log identically and the
                        // rep progress between weight jumps never shows up.
                        Text(
                            "\u00d7",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.width(6.dp))
                        OutlinedTextField(
                            value = m.reps,
                            onValueChange = { vm.onReps(planId, m.poolExerciseId, it) },
                            placeholder = { Text("reps") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f, fill = false).widthIn(max = NUM_FIELD_W),
                        )
                    }
                }

                // Cell 3 — over the log button. This movement's history, hard
                // right of its own entry fields.
                Box(Modifier.weight(1f)) {
                    m.stats?.let { MovementHistory(it) }
                }
            }
        } else {
            Text(
                "Skipped",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    if (swapping) {
        SwapMovementDialog(planId, m, vm) { swapping = false }
    }
}

/**
 * Pick a variation for one movement, for today only. Same-category movements
 * first (swapping a bench press for a plank is not the point), the current
 * movement's muscle group floated to the top, and a search box because the pool
 * is long. Nothing is written here — the choice only changes what the Log button
 * sends.
 */
@Composable
private fun SwapMovementDialog(
    planId: String,
    m: MovementInput,
    vm: WorkoutLogViewModel,
    onDismiss: () -> Unit,
) {
    val ui by vm.ui.collectAsState()
    var query by remember { mutableStateOf("") }
    val current = ui.pool.firstOrNull { it.id == m.poolExerciseId }
    val q = query.trim().lowercase()

    // Grouped by muscle group, with a heading per group. Floating the current
    // group to the top of a flat list was not enough: everything below it ran
    // together alphabetically across every muscle group, so the list read as
    // one jumble. The movement's own group comes first, then the rest
    // alphabetically, with unassigned movements last under "Other".
    val groups = remember(ui.pool, q, current?.id) {
        ui.pool
            .asSequence()
            .filter { it.id != m.poolExerciseId }
            .filter { current == null || it.category == current.category }
            .filter { q.isEmpty() || it.name.lowercase().contains(q) }
            .groupBy { it.muscleGroup }
            .map { (mg, items) ->
                SwapGroup(
                    key = mg ?: "_other",
                    label = if (mg != null) muscleLabel(mg) else "Other",
                    items = items.sortedBy { it.name.lowercase() },
                )
            }
            // Straight alphabetical by muscle group, movements alphabetical
            // inside each. Floating the current group to the top meant the list
            // started somewhere different every time it opened.
            .sortedWith(
                compareBy<SwapGroup> { it.key == "_other" }
                    .thenBy { it.label.lowercase() },
            )
    }
    val total = groups.sumOf { it.items.size }

    AnimatedDialog(
        onDismissRequest = onDismiss,
        title = "Swap ${m.name}",
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Today only \u2014 your plan keeps ${m.swappedFromName ?: m.name}.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search movements") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            when {
                ui.poolLoading -> Text(
                    "Loading movements\u2026",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                total == 0 -> Text(
                    if (ui.pool.isEmpty()) "Couldn't load the movement list." else "No movements match.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> Column(
                    Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState()),
                ) {
                    groups.forEach { g ->
                        Text(
                            g.label.uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 8.dp, top = 12.dp, bottom = 2.dp),
                        )
                        g.items.forEach { ex ->
                            Text(
                                ex.name,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        vm.swapMovement(planId, m.poolExerciseId, ex)
                                        onDismiss()
                                    }
                                    .padding(horizontal = 8.dp, vertical = 10.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Verb-noun for the log button, matching the web (weight/time/distance/reps). */
private fun logNoun(inputs: List<MovementInput>): String {
    val metrics = inputs.map { it.metric }.toSet()
    if (metrics.size != 1) return "workout"
    return when (metrics.first()) {
        "WEIGHT" -> "weight"
        "REPS" -> "reps"
        "DISTANCE" -> "distance"
        "METERS" -> "meters"
        "DURATION" -> "time"
        else -> "workout"
    }
}

/**
 * Three lines of history for one movement, to the right of its entry fields.
 *
 * Always three, with an em dash where there is nothing yet: a line that
 * disappears shifts the other two, and a row that changes shape as you log is
 * harder to read than one with a gap in it.
 *
 * Three different questions, deliberately not collapsed into one:
 *   Best       the heaviest ever lifted, weight only.
 *   Best reps  the MOST reps ever done, with the weight they were done at —
 *              usually a lighter bar than the record, which is the point.
 *   Latest     the last session, even when it is below both records.
 *
 * No dates and no repeated unit: this sits in a third of a phone's width, and
 * the unit is already printed beside the weight box on the same row.
 */
@Composable
private fun MovementHistory(st: com.kairos.app.data.remote.dto.MovementStatsDto) {
    val dash = "\u2014"
    Column(Modifier.fillMaxWidth()) {
        HistoryLine("Best", fmtNum(st.bestWeight))
        HistoryLine(
            "Best reps",
            if (st.bestReps != null && st.bestRepsWeight != null) {
                "${fmtNum(st.bestRepsWeight)} \u00d7 ${st.bestReps}"
            } else {
                dash
            },
        )
        HistoryLine(
            "Latest",
            buildString {
                append(fmtNum(st.lastWeight))
                st.lastReps?.let { reps ->
                    append(" \u00d7 ")
                    append(reps)
                }
            },
        )
    }
}

/**
 * Label hard left, value hard right, so the labels start in one column and the
 * values end in another.
 *
 * The VALUE is the unweighted child: a Row measures those first, so the number
 * always gets the width it needs and the label ellipsizes instead. The other
 * way round, a long label would push the number off the edge of the cell.
 */
@Composable
private fun HistoryLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = KairosThemeState.accent,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            value,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
        )
    }
}

/** Trailing ".0" off a whole-number weight: 105, not 105.0. */
private fun fmtNum(v: Double): String =
    if (v % 1.0 == 0.0) v.toInt().toString() else v.toString()

