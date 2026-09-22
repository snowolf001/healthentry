package com.cleanutilityapps.healthentry.widget

import android.app.Application
import android.content.res.Configuration
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RemoteViews
import android.widget.TextView
import com.cleanutilityapps.healthentry.R
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.roundToInt

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WidgetLayoutTest {
    @Test fun iconsAndCompleteCaptionsFitCompactRemoteViewsInBothThemes() {
        val app = RuntimeEnvironment.getApplication()
        val layouts = listOf(
            R.layout.water_widget to "8 oz",
            R.layout.coffee_widget to "95 mg",
            R.layout.weight_widget to "Enter",
        )
        for (night in listOf(Configuration.UI_MODE_NIGHT_NO, Configuration.UI_MODE_NIGHT_YES)) {
            for (scale in listOf(1f, 1.3f, 1.5f)) {
                val configuration = Configuration(app.resources.configuration).apply {
                    uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or night
                    fontScale = scale
                }
                val context = app.createConfigurationContext(configuration)
                val density = context.resources.displayMetrics.density
                for ((layout, caption) in layouts) {
                    for (dp in listOf(48, 56)) {
                        val root = RemoteViews(app.packageName, layout)
                            .apply(context, FrameLayout(context)) as LinearLayout
                        val size = (dp * density).roundToInt()
                        root.measure(
                            View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY),
                            View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY),
                        )
                        root.layout(0, 0, size, size)
                        assertEquals(2, root.childCount)
                        val icon = root.getChildAt(0) as ImageView
                        val text = root.getChildAt(1) as TextView
                        assertNotNull(icon.drawable)
                        assertEquals((28 * density).roundToInt(), icon.width)
                        assertEquals((28 * density).roundToInt(), icon.height)
                        assertEquals(context.getColor(R.color.widget_text_secondary), text.currentTextColor)
                        assertTrue(kotlin.math.abs(icon.left + icon.right - size) <= 1)
                        assertTrue(kotlin.math.abs(text.left + text.right - size) <= 1)
                        assertEquals(caption, text.text.toString())
                        assertEquals(1, text.lineCount)
                        assertNull(text.ellipsize)
                        assertEquals(0, text.layout.getEllipsisCount(0))
                        assertTrue("$caption width at $dp dp / $scale", text.layout.getLineWidth(0) <= text.width)
                        assertTrue("$caption height ${text.layout.height} > ${text.height} at $dp dp / $scale", text.layout.height <= text.height)
                        for (child in listOf(icon, text)) {
                            assertTrue(child.left >= root.paddingLeft)
                            assertTrue(child.right <= size - root.paddingRight)
                            assertTrue(child.top >= root.paddingTop)
                            assertTrue(child.bottom <= size - root.paddingBottom)
                            assertEquals(View.IMPORTANT_FOR_ACCESSIBILITY_NO, child.importantForAccessibility)
                        }
                        assertTrue(root.isClickable)
                        assertTrue(root.contentDescription.contains("HealthEntry"))
                    }
                }
            }
        }
    }
}
