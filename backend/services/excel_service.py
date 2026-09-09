import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

HEADER_FILL = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)
TITLE_FONT = Font(bold=True, size=14)
LABEL_FONT = Font(bold=True)


def _write_header_row(ws, row, values):
    for col, value in enumerate(values, start=1):
        cell = ws.cell(row=row, column=col, value=value)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT


def build_weekly_report_xlsx(report: dict) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Weekly Report"

    ws.cell(row=1, column=1, value=f"{report['house_name']} — Weekly House Report").font = TITLE_FONT
    ws.cell(row=2, column=1, value=f"Week: {report['week_start']} to {report['week_end']}")

    ws.cell(row=4, column=1, value="Current Points").font = LABEL_FONT
    ws.cell(row=4, column=2, value=report["current_points"])
    ws.cell(row=5, column=1, value="House Rank").font = LABEL_FONT
    ws.cell(row=5, column=2, value=report["rank"])

    ws.cell(row=7, column=1, value="").value = None
    _write_header_row(ws, 7, ["Metric", "This Week", "Last Week"])
    ws.cell(row=8, column=1, value="Late Entries")
    ws.cell(row=8, column=2, value=report["this_week"]["late_entries"])
    ws.cell(row=8, column=3, value=report["last_week"]["late_entries"])
    ws.cell(row=9, column=1, value="Points Lost")
    ws.cell(row=9, column=2, value=report["this_week"]["points_lost"])
    ws.cell(row=9, column=3, value=report["last_week"]["points_lost"])

    start_row = 12
    ws.cell(row=start_row - 1, column=1, value="Daily Breakdown").font = LABEL_FONT
    _write_header_row(ws, start_row, ["Date", "Day", "Late Entries"])
    for i, day in enumerate(report["daily_trend"]):
        r = start_row + 1 + i
        ws.cell(row=r, column=1, value=day["date"])
        ws.cell(row=r, column=2, value=day["day"])
        ws.cell(row=r, column=3, value=day["count"])

    top_start = start_row + len(report["daily_trend"]) + 3
    ws.cell(row=top_start - 1, column=1, value="Top 5 Most Frequent Late Students").font = LABEL_FONT
    _write_header_row(ws, top_start, ["Name", "Student Code", "Class", "Late Count"])
    for i, s in enumerate(report["top_students"]):
        r = top_start + 1 + i
        ws.cell(row=r, column=1, value=s["name"])
        ws.cell(row=r, column=2, value=s["student_code"])
        ws.cell(row=r, column=3, value=s["class"])
        ws.cell(row=r, column=4, value=s["late_count"])

    for col, width in zip("ABCD", [30, 16, 16, 14]):
        ws.column_dimensions[col].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
