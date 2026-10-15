# Thesis report

`MeQ_Thesis_Draft.docx` is generated. Edit the text in `report_content.py`, then rebuild:

```bash
python -I docs/report/build_report.py <department-template.docx> docs/report/MeQ_Thesis_Draft.docx
```

- The template is a previous NU CS thesis `.docx` (layout, styles, chapter numbering, page numbers). It is not committed.
- Inline markup in `report_content.py`: `**bold**`, `*italic*`, `` `code` ``, `{{to complete}}` (yellow highlight).
- Put screenshots in `docs/report/screenshots/` with the names used in `report_content.py`; a missing image becomes a yellow placeholder.
- Report diagrams: `docs/report/diagrams/` (Mermaid with `mermaid-config.json`, and two SVG scripts for the use case and architecture figures), rendered to `docs/report/images/`.
- In Word, answer **Yes** when asked to update fields, so the table of contents and the lists of tables and figures are built.
