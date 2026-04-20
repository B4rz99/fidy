#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from statistics import mean


@dataclass(frozen=True)
class FunctionMetric:
    nloc: int
    cyclomatic_complexity: int
    token_count: int
    parameter_count: int
    length: int
    location: str
    filename: str
    function_name: str
    long_name: str
    start_line: int
    end_line: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, dest="csv_path")
    parser.add_argument("--markdown", required=True, dest="markdown_path")
    parser.add_argument("--json", required=True, dest="json_path")
    parser.add_argument("--version", required=True)
    parser.add_argument("--target", action="append", default=[])
    parser.add_argument("--ccn-threshold", required=True, type=int)
    parser.add_argument("--nloc-threshold", required=True, type=int)
    parser.add_argument("--parameter-threshold", required=True, type=int)
    return parser.parse_args()


def parse_row(row: list[str]) -> FunctionMetric:
    return FunctionMetric(
        nloc=int(row[0]),
        cyclomatic_complexity=int(row[1]),
        token_count=int(row[2]),
        parameter_count=int(row[3]),
        length=int(row[4]),
        location=row[5],
        filename=row[6],
        function_name=row[7],
        long_name=row[8],
        start_line=int(row[9]),
        end_line=int(row[10]),
    )


def load_metrics(csv_path: Path) -> list[FunctionMetric]:
    with csv_path.open(newline="") as handle:
        rows = csv.reader(handle)
        return [parse_row(row) for row in rows if row]


def top_records(
    metrics: list[FunctionMetric],
    key_name: str,
    limit: int = 15,
) -> list[dict[str, int | str]]:
    return [
        {
            "function": metric.function_name,
            "file": metric.filename,
            "start_line": metric.start_line,
            "end_line": metric.end_line,
            "nloc": metric.nloc,
            "cyclomatic_complexity": metric.cyclomatic_complexity,
            "token_count": metric.token_count,
            "parameter_count": metric.parameter_count,
            "length": metric.length,
        }
        for metric in sorted(
            metrics,
            key=lambda metric: (getattr(metric, key_name), metric.nloc, metric.token_count),
            reverse=True,
        )[:limit]
    ]


def build_file_hotspots(metrics: list[FunctionMetric], limit: int = 15) -> list[dict[str, int | str | float]]:
    per_file = {}
    for metric in metrics:
        aggregate = per_file.setdefault(
            metric.filename,
            {
                "file": metric.filename,
                "function_count": 0,
                "total_nloc": 0,
                "total_ccn": 0,
                "max_ccn": 0,
                "max_nloc": 0,
            },
        )
        aggregate["function_count"] += 1
        aggregate["total_nloc"] += metric.nloc
        aggregate["total_ccn"] += metric.cyclomatic_complexity
        aggregate["max_ccn"] = max(aggregate["max_ccn"], metric.cyclomatic_complexity)
        aggregate["max_nloc"] = max(aggregate["max_nloc"], metric.nloc)

    return sorted(
        (
            {
                **aggregate,
                "avg_ccn": round(aggregate["total_ccn"] / aggregate["function_count"], 2),
            }
            for aggregate in per_file.values()
        ),
        key=lambda aggregate: (aggregate["max_ccn"], aggregate["total_ccn"], aggregate["total_nloc"]),
        reverse=True,
    )[:limit]


def build_summary(
    metrics: list[FunctionMetric],
    version: str,
    targets: list[str],
    ccn_threshold: int,
    nloc_threshold: int,
    parameter_threshold: int,
) -> dict[str, object]:
    return {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "lizard_version": version,
        "targets": targets,
        "strict_thresholds": {
            "cyclomatic_complexity": ccn_threshold,
            "nloc": nloc_threshold,
            "parameter_count": parameter_threshold,
            "variant": "classic",
        },
        "totals": {
            "function_count": len(metrics),
            "total_nloc": sum(metric.nloc for metric in metrics),
            "avg_nloc": round(mean(metric.nloc for metric in metrics), 2),
            "avg_ccn": round(mean(metric.cyclomatic_complexity for metric in metrics), 2),
            "avg_token_count": round(mean(metric.token_count for metric in metrics), 2),
            "max_ccn": max(metric.cyclomatic_complexity for metric in metrics),
            "max_nloc": max(metric.nloc for metric in metrics),
            "max_parameter_count": max(metric.parameter_count for metric in metrics),
            "max_token_count": max(metric.token_count for metric in metrics),
        },
        "threshold_counts": {
            "current_target_violation_count": sum(
                metric.cyclomatic_complexity > ccn_threshold
                or metric.nloc > nloc_threshold
                or metric.parameter_count > parameter_threshold
                for metric in metrics
            ),
            "ccn_gt_target": sum(metric.cyclomatic_complexity > ccn_threshold for metric in metrics),
            "nloc_gt_target": sum(metric.nloc > nloc_threshold for metric in metrics),
            "params_gt_target": sum(metric.parameter_count > parameter_threshold for metric in metrics),
            "ccn_gt_10": sum(metric.cyclomatic_complexity > 10 for metric in metrics),
            "ccn_gt_15": sum(metric.cyclomatic_complexity > 15 for metric in metrics),
            "ccn_gt_20": sum(metric.cyclomatic_complexity > 20 for metric in metrics),
            "nloc_gt_50": sum(metric.nloc > 50 for metric in metrics),
            "nloc_gt_100": sum(metric.nloc > 100 for metric in metrics),
            "params_gt_4": sum(metric.parameter_count > 4 for metric in metrics),
            "params_gt_6": sum(metric.parameter_count > 6 for metric in metrics),
        },
        "top_by_ccn": top_records(metrics, "cyclomatic_complexity"),
        "top_by_nloc": top_records(metrics, "nloc"),
        "top_by_parameters": top_records(metrics, "parameter_count", limit=10),
        "top_by_tokens": top_records(metrics, "token_count"),
        "file_hotspots": build_file_hotspots(metrics),
    }


def format_row(
    item: dict[str, int | str | float],
    columns: list[str],
) -> str:
    return "| " + " | ".join(str(item[column]) for column in columns) + " |"


def write_markdown(summary: dict[str, object], markdown_path: Path) -> None:
    totals = summary["totals"]
    threshold_counts = summary["threshold_counts"]
    lines = [
        "# Lizard Strict Complexity Report",
        "",
        f"- Generated at: {summary['generated_at_utc']}",
        f"- Lizard version: `{summary['lizard_version']}`",
        f"- Targets: `{', '.join(summary['targets'])}`",
        f"- Strict thresholds: `CCN>{summary['strict_thresholds']['cyclomatic_complexity']}`, `NLOC>{summary['strict_thresholds']['nloc']}`, `parameter_count>{summary['strict_thresholds']['parameter_count']}`, classic variant",
        "",
        "## Totals",
        "",
        f"- Functions scanned: {totals['function_count']}",
        f"- Total NLOC: {totals['total_nloc']}",
        f"- Average NLOC: {totals['avg_nloc']}",
        f"- Average CCN: {totals['avg_ccn']}",
        f"- Average token count: {totals['avg_token_count']}",
        f"- Max CCN: {totals['max_ccn']}",
        f"- Max NLOC: {totals['max_nloc']}",
        f"- Max parameter count: {totals['max_parameter_count']}",
        f"- Max token count: {totals['max_token_count']}",
        "",
        "## Conventional Threshold Counts",
        "",
        f"- Current target violations: {threshold_counts['current_target_violation_count']}",
        f"- Functions with `CCN > {summary['strict_thresholds']['cyclomatic_complexity']}`: {threshold_counts['ccn_gt_target']}",
        f"- Functions with `NLOC > {summary['strict_thresholds']['nloc']}`: {threshold_counts['nloc_gt_target']}",
        f"- Functions with `parameter_count > {summary['strict_thresholds']['parameter_count']}`: {threshold_counts['params_gt_target']}",
        f"- Functions with `CCN > 10`: {threshold_counts['ccn_gt_10']}",
        f"- Functions with `CCN > 15`: {threshold_counts['ccn_gt_15']}",
        f"- Functions with `CCN > 20`: {threshold_counts['ccn_gt_20']}",
        f"- Functions with `NLOC > 50`: {threshold_counts['nloc_gt_50']}",
        f"- Functions with `NLOC > 100`: {threshold_counts['nloc_gt_100']}",
        f"- Functions with `parameter_count > 4`: {threshold_counts['params_gt_4']}",
        f"- Functions with `parameter_count > 6`: {threshold_counts['params_gt_6']}",
        "",
        "## Top Functions By CCN",
        "",
        "| Function | File | Lines | CCN | NLOC | Tokens | Params |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    lines.extend(
        format_row(
            {
                "function": item["function"],
                "file": item["file"],
                "lines": f"{item['start_line']}-{item['end_line']}",
                "ccn": item["cyclomatic_complexity"],
                "nloc": item["nloc"],
                "tokens": item["token_count"],
                "params": item["parameter_count"],
            },
            ["function", "file", "lines", "ccn", "nloc", "tokens", "params"],
        )
        for item in summary["top_by_ccn"]
    )

    lines.extend(
        [
            "",
            "## Top Functions By NLOC",
            "",
            "| Function | File | Lines | NLOC | CCN | Tokens | Params |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    lines.extend(
        format_row(
            {
                "function": item["function"],
                "file": item["file"],
                "lines": f"{item['start_line']}-{item['end_line']}",
                "nloc": item["nloc"],
                "ccn": item["cyclomatic_complexity"],
                "tokens": item["token_count"],
                "params": item["parameter_count"],
            },
            ["function", "file", "lines", "nloc", "ccn", "tokens", "params"],
        )
        for item in summary["top_by_nloc"]
    )

    lines.extend(
        [
            "",
            "## File Hotspots",
            "",
            "| File | Functions | Max CCN | Avg CCN | Total CCN | Max NLOC | Total NLOC |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    lines.extend(
        format_row(
            {
                "file": item["file"],
                "functions": item["function_count"],
                "max_ccn": item["max_ccn"],
                "avg_ccn": item["avg_ccn"],
                "total_ccn": item["total_ccn"],
                "max_nloc": item["max_nloc"],
                "total_nloc": item["total_nloc"],
            },
            ["file", "functions", "max_ccn", "avg_ccn", "total_ccn", "max_nloc", "total_nloc"],
        )
        for item in summary["file_hotspots"]
    )

    markdown_path.write_text("\n".join(lines) + "\n")


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv_path)
    markdown_path = Path(args.markdown_path)
    json_path = Path(args.json_path)

    metrics = load_metrics(csv_path)
    if not metrics:
        raise SystemExit("No Lizard records were found in the CSV report.")

    summary = build_summary(
        metrics,
        args.version,
        args.target,
        args.ccn_threshold,
        args.nloc_threshold,
        args.parameter_threshold,
    )
    json_path.write_text(json.dumps(summary, indent=2) + "\n")
    write_markdown(summary, markdown_path)


if __name__ == "__main__":
    main()
