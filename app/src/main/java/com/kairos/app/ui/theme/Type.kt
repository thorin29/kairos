package com.kairos.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.kairos.app.R

/**
 * The web's type: IBM Plex Sans for text, Bricolage Grotesque for headings
 * (src/app/layout.tsx). The files are the web's own, converted to TTF; the
 * variable Bricolage is cut to its 600 and 700 weights. Anything they don't
 * cover (emoji, other scripts) falls back to the system font.
 */
val PlexSans = FontFamily(
    Font(R.font.plex_sans_400, FontWeight.Normal),
    Font(R.font.plex_sans_500, FontWeight.Medium),
    Font(R.font.plex_sans_600, FontWeight.SemiBold),
    // No 700 file: bold text uses the semibold cut rather than a faked bold.
    Font(R.font.plex_sans_600, FontWeight.Bold),
)

val Bricolage = FontFamily(
    Font(R.font.bricolage_600, FontWeight.Normal),
    Font(R.font.bricolage_600, FontWeight.Medium),
    Font(R.font.bricolage_600, FontWeight.SemiBold),
    Font(R.font.bricolage_700, FontWeight.Bold),
)

private val base = Typography()

private fun TextStyle.text(weight: FontWeight? = null) =
    copy(fontFamily = PlexSans, fontWeight = weight ?: fontWeight)

private fun TextStyle.heading() = copy(fontFamily = Bricolage, fontWeight = FontWeight.SemiBold)

/** Headings (display, headline, title large) in Bricolage, everything else in
 *  Plex Sans; titles and labels a step heavier than Material's defaults, which
 *  read thin. */
val KairosTypography = Typography(
    displayLarge = base.displayLarge.heading(),
    displayMedium = base.displayMedium.heading(),
    displaySmall = base.displaySmall.heading(),
    headlineLarge = base.headlineLarge.heading(),
    headlineMedium = base.headlineMedium.heading(),
    headlineSmall = base.headlineSmall.heading(),
    titleLarge = base.titleLarge.heading(),
    titleMedium = base.titleMedium.text(FontWeight.SemiBold),
    titleSmall = base.titleSmall.text(FontWeight.SemiBold),
    bodyLarge = base.bodyLarge.text(),
    bodyMedium = base.bodyMedium.text(),
    bodySmall = base.bodySmall.text(),
    labelLarge = base.labelLarge.text(FontWeight.SemiBold),
    labelMedium = base.labelMedium.text(FontWeight.Medium),
    labelSmall = base.labelSmall.text(FontWeight.Medium),
)
