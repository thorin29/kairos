// Kotlin side of the parity check: compiled together with the app's
// IcsImport.kt (see check.sh). Prints the same canonical line as run-ts.ts.
import com.kairos.app.ui.calendar.IcsImport
import com.kairos.app.ui.calendar.readIcsFile
import java.io.File

private fun js(s: String?): String {
    if (s == null) return "null"
    val b = StringBuilder("\"")
    var i = 0
    while (i < s.length) {
        val c = s[i]
        val paired = (c.isHighSurrogate() && i + 1 < s.length && s[i + 1].isLowSurrogate()) ||
            (c.isLowSurrogate() && i > 0 && s[i - 1].isHighSurrogate())
        when {
            c == '"' -> b.append("\\\"")
            c == '\\' -> b.append("\\\\")
            c == '\n' -> b.append("\\n")
            c == '\r' -> b.append("\\r")
            c == '\t' -> b.append("\\t")
            c == '\b' -> b.append("\\b")
            c == '\u000c' -> b.append("\\f")
            // Control characters and LONE surrogates escape as JSON.stringify
            // does, so a broken character shows as a diff, not '?' on both sides.
            c < ' ' || (c.isSurrogate() && !paired) -> b.append("\\u%04x".format(c.code))
            else -> b.append(c)
        }
        i++
    }
    return b.append('"').toString()
}

fun main(args: Array<String>) {
    val dir = File(args[0])
    val tz = args[1]
    val files = dir.listFiles { f -> f.name.endsWith(".ics") }!!.sortedBy { it.name }
    val out = StringBuilder()
    for (f in files) {
        val line = when (val r = readIcsFile(f.readText(Charsets.UTF_8), tz)) {
            is IcsImport.Event -> {
                val d = r.draft
                "{\"kind\":\"event\",\"title\":${js(d.title)},\"allDay\":${d.allDay}," +
                    "\"startDate\":${js(d.startDate)},\"startTime\":${js(d.startTime)}," +
                    "\"endDate\":${js(d.endDate)},\"endTime\":${js(d.endTime)}," +
                    "\"location\":${js(d.location)},\"notes\":${js(d.notes)}," +
                    "\"repeat\":${js(d.repeat)},\"repeatDropped\":${d.repeatDropped}}"
            }
            is IcsImport.Many -> "{\"kind\":\"many\",\"count\":${r.count}}"
            IcsImport.Cancelled -> "{\"kind\":\"cancelled\"}"
            IcsImport.None -> "{\"kind\":\"none\"}"
        }
        out.append(f.name).append('\t').append(line).append('\n')
    }
    val ps = java.io.PrintStream(java.io.FileOutputStream(java.io.FileDescriptor.out), true, "UTF-8")
    ps.print(out)
    ps.flush()
}
