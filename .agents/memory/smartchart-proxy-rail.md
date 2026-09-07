---
name: SmartChart proxy rail scoping
description: Rules for keeping custom chart controls attached to the correct SmartChart instance
---

The visible chart rail must scope native-control lookups to its closest `.dashboard__chart-wrapper`, not query the document globally. Its four native SmartChart dialogs open as compact, vertically centered panels toward the chart's right side through the per-chart Quill portal.

**Why:** The normal chart and expanded/modal chart can be mounted together, so a global selector can open the first chart's menu instead of the chart whose rail was clicked.

**How to apply:** Keep native SmartChart controls mounted for real behavior, hide the duplicate toolbar visually, proxy each rail action through the nearest chart wrapper, and style `.smartcharts-quill-portal` rather than rebuilding indicator/drawing functionality. Keep the panel centered and floating, not full-height.