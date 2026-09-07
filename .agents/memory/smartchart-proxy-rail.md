---
name: SmartChart proxy rail scoping
description: Rules for keeping custom chart controls attached to the correct SmartChart instance
---

The visible chart rail must scope native-control lookups to its closest `.dashboard__chart-wrapper`, not query the document globally. Four compact fixed-size settings buttons sit lower-left, native navigation stays bottom-center, and dialogs open as compact panels beside the rail.

**Why:** The normal chart and expanded/modal chart can be mounted together, so a global selector can open the first chart's menu instead of the chart whose rail was clicked.

**How to apply:** Keep native SmartChart controls mounted for real behavior, hide the duplicate toolbar with `display:none` while retaining its DOM for programmatic proxy clicks, hard-constrain the visible rail buttons so SmartChart flex rules cannot stretch them, proxy each rail action through the nearest chart wrapper, and style `.smartcharts-quill-portal` rather than rebuilding indicator/drawing functionality. Keep the panel small and floating, not full-height or centered over the chart.