#!/usr/bin/env python3
"""Собирает все страницы портала в один self-contained файл EpiPrint.html."""
import re, pathlib

base = pathlib.Path(__file__).parent
css     = (base/"assets/style.css").read_text(encoding="utf-8")
data    = (base/"assets/data.js").read_text(encoding="utf-8")
app     = (base/"assets/app.js").read_text(encoding="utf-8")
logo    = (base/"assets/logo.js").read_text(encoding="utf-8")
reportv = (base/"assets/report-view.js").read_text(encoding="utf-8")
portal  = (base/"assets/portal-app.js").read_text(encoding="utf-8")

# ядро app.js без авто-запуска старой оболочки (в SPA оболочку рисует роутер)
app = app.replace("document.addEventListener('DOMContentLoaded', renderShell);",
                  "/* shell handled by SPA router */")

# стили заключения из report.html
report_css = re.search(r'<style>([\s\S]*?)</style>', (base/"report.html").read_text(encoding="utf-8")).group(1)

html = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EpiPrint — портал</title>
<style>
{css}
/* ---- стили заключения ---- */
{report_css}
</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar" id="sidebar"></aside>
  <div class="main">
    <header class="topbar" id="topbar"></header>
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
out = base/"EpiPrint.html"
out.write_text(html, encoding="utf-8")
print(f"built {out.name} ({len(html)//1024} KB)")
