package com.cleanutilityapps.healthentry.widget

import org.junit.Assert.*
import org.junit.Test

class WidgetSessionGateTest {
    @Test fun eachPresetIsConsumedExactlyOnce() {
        for (action in listOf("water", "coffee", "weight")) {
            val gate = WidgetSessionGate()
            val id = gate.open(action, false, false)!!
            assertEquals(action, gate.consume(id))
            assertNull(gate.consume(id))
            assertTrue(gate.close(id))
            assertNull(gate.consume(id))
        }
    }
    @Test fun restoreHistoryAndUnknownActionsNeverStart() {
        val gate = WidgetSessionGate()
        assertNull(gate.open("water", true, false))
        assertNull(gate.open("coffee", false, true))
        assertNull(gate.open("bloodPressure", false, false))
        assertNull(gate.open(null, false, false))
        assertNotNull(gate.open("weight", false, false))
    }
    @Test fun rapidTapsAndDuplicateBeginCannotWriteTwice() {
        val gate = WidgetSessionGate()
        val id = gate.open("water", false, false)!!
        assertFalse(gate.beginWrite(id)) // Cannot submit an unconsumed launch.
        gate.consume(id)
        assertTrue(gate.beginWrite(id))
        assertFalse(gate.beginWrite(id))
        assertNull(gate.open("coffee", false, false))
        assertFalse(gate.close(id)) // Destroy/back cannot unlock an in-flight write.
        gate.endWrite(id)
        assertTrue(gate.close(id))
        assertNotNull(gate.open("coffee", false, false))
        assertFalse(gate.beginWrite(id)) // A stale callback cannot touch the new session.
    }
    @Test fun weightCancelAndExplicitRetryDoNotReplayLaunch() {
        val gate = WidgetSessionGate()
        val cancelled = gate.open("weight", false, false)!!
        gate.consume(cancelled)
        assertTrue(gate.close(cancelled))
        assertFalse(gate.beginWrite(cancelled))
        val id = gate.open("weight", false, false)!!
        gate.consume(id)
        assertTrue(gate.beginWrite(id))
        gate.endWrite(id) // Failed submission keeps the same input session open.
        assertNull(gate.consume(id))
        assertTrue(gate.beginWrite(id)) // Only explicit Add retries.
        gate.endWrite(id)
        assertTrue(gate.close(id))
    }
}
