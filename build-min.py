#!/usr/bin/env python3
"""Собирает минималистичную (LIMS) версию портала в один файл EpiPrint_lab.html."""
import re, pathlib

base = pathlib.Path(__file__).parent
css     = (base/"assets/style-min.css").read_text(encoding="utf-8")
data    = (base/"assets/data.js").read_text(encoding="utf-8")
app     = (base/"assets/app.js").read_text(encoding="utf-8")
logo    = (base/"assets/logo.js").read_text(encoding="utf-8")
reportv = (base/"assets/report-view.js").read_text(encoding="utf-8")
portal  = (base/"assets/portal-min.js").read_text(encoding="utf-8")

app = app.replace("document.addEventListener('DOMContentLoaded', renderShell);",
                  "/* shell handled by min router */")

report_css = re.search(r'<style>([\s\S]*?)</style>', (base/"report.html").read_text(encoding="utf-8")).group(1)

html = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EpiPrint · Lab</title>
<style>
{css}
/* ---- стили заключения ---- */
{report_css}
</style>
</head>
<body>
<div class="layout">
  <aside class="sb" id="sb"></aside>
  <div class="main">
    <header class="top" id="top"></header>
    <main class="content" id="view"></main>
  </div>
</div>
<script>
{data}
</script>
<script>
{app}
</script>
<script>
{logo}
</script>
<script>
{reportv}
</script>
<script>
{portal}
</script>
</body>
</html>
"""
out = base/"EpiPrint_lab.html"
out.write_text(html, encoding="utf-8")
print(f"built {out.name} ({len(html)//1024} KB)")
