#!/usr/bin/env python3
"""
Speed chart generator for Primary GPS Data CSV.

Usage:
  python chart.py path/to/file.csv

Output:
  speed_chart.svg / speed_chart.png
  speed_chart_<STATION>_<n>_decel.svg / .png
"""
import sys, re, csv, os, datetime, glob, math
from typing import List, Tuple, Optional

# Minimum stop duration (seconds) to qualify for station legend
MIN_STOP_DURATION_SECONDS = 30
# Speed threshold for deceleration charts (km/h)
DECEL_THRESHOLD_KMPH = 15.0
INPUT_PATTERN = '*PrimaryGPSData*.csv'
PNG_OUTPUT = True  # enable PNG alongside SVG for report embedding

# --- Helpers -----------------------------------------------------------------

def find_input(path_arg: Optional[str]) -> str:
    if path_arg and os.path.isfile(path_arg):
        return path_arg
    matches = sorted(glob.glob(INPUT_PATTERN))
    if not matches:
        raise SystemExit('No input file found matching pattern.')
    for m in matches:
        if 'modified' in m.lower():
            return m
    return matches[0]

def extract_date_from_filename(fname: str) -> Optional[datetime.date]:
    m = re.search(r'(20\d{2}-\d{2}-\d{2})', fname)
    if m:
        try:
            return datetime.date.fromisoformat(m.group(1))
        except ValueError:
            return None
    return None

# --- Core parsing -------------------------------------------------------------

def parse_csv(path: str) -> Tuple[List[datetime.datetime], List[float], List[str], List[float]]:
    """Return (timestamps, speeds, stationCodes, distFromPrev in meters)."""
    base_date = extract_date_from_filename(os.path.basename(path)) or datetime.date.today()
    times: List[datetime.datetime] = []
    speeds: List[float] = []
    stations: List[str] = []
    dprev: List[float] = []
    def parse_time_flexible(time_val):
        # Try %H:%M:%S first
        try:
            return datetime.datetime.strptime(time_val, '%H:%M:%S').time()
        except Exception:
            pass
        # Try %m/%d/%y %H:%M or %m/%d/%y %H:%M:%S
        for fmt in ('%m/%d/%y %H:%M', '%m/%d/%y %H:%M:%S', '%m/%d/%Y %H:%M', '%m/%d/%Y %H:%M:%S'):
            try:
                return datetime.datetime.strptime(time_val, fmt).time()
            except Exception:
                continue
        return None

    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        header_map = {col.strip().lower(): idx for idx, col in enumerate(header)} if header else {}
        # Define expected columns (case-insensitive)
        col_time = next((header_map[k] for k in header_map if k in ['time', 'event_detection_time', 'event_time']), 1)
        col_speed = next((header_map[k] for k in header_map if k in ['speed', 'loco_speed', 'speed(kmph)']), 2)
        col_station = next((header_map[k] for k in header_map if k in ['station_code', 'station', 'stationname', 'station_name']), 8)
        col_dist = next((header_map[k] for k in header_map if k in ['distance', 'dist', 'distancefromprev', 'distfromprev']), 6)
        for row in reader:
            if not row or all(not c.strip() for c in row):
                continue
            if len(row) < len(header):
                row += [''] * (len(header) - len(row))
            time_str = row[col_time].strip()
            speed_str = row[col_speed].strip()
            station = row[col_station].strip() if col_station < len(row) else ''
            if not time_str or not speed_str:
                dprev.append(0.0)
                continue
            t = parse_time_flexible(time_str)
            if t is None:
                dprev.append(0.0)
                continue
            dt = datetime.datetime.combine(base_date, t)
            try:
                sp = float(speed_str)
                if sp < 0.7:
                    sp = 0.0
                sp = int(sp)
            except ValueError:
                dprev.append(0.0)
                continue
            dist_val = 0.0
            if col_dist < len(row):
                try:
                    dist_val = float(row[col_dist]) if row[col_dist].strip() else 0.0
                except ValueError:
                    dist_val = 0.0
            times.append(dt)
            speeds.append(sp)
            stations.append(station)
            dprev.append(dist_val)
    return times, speeds, stations, dprev

# --- Station stop detection ---------------------------------------------------

def detect_station_stops(times: List[datetime.datetime], speeds: List[float], stations: List[str], min_duration_s: int) -> List[int]:
    stops = []
    n = len(speeds)
    i = 0
    while i < n:
        if speeds[i] == 0:
            start_i = i
            start_t = times[i]
            j = i + 1
            while j < n and speeds[j] == 0 and stations[j] == stations[start_i]:
                j += 1
            end_i = j - 1
            end_t = times[end_i]
            duration = (end_t - start_t).total_seconds()
            station_code = stations[start_i]
            if station_code and duration >= min_duration_s:
                stops.append(start_i)
            i = j
        else:
            i += 1
    return stops

def detect_station_stop_segments(times: List[datetime.datetime], speeds: List[float], stations: List[str], min_duration_s: int):
    """Return list of (station, start_time, end_time, start_idx, end_idx) for qualifying zero-speed segments."""
    segments = []
    n = len(speeds)
    i = 0
    while i < n:
        if speeds[i] == 0:
            start_i = i
            start_t = times[i]
            j = i + 1
            while j < n and speeds[j] == 0 and stations[j] == stations[start_i]:
                j += 1
            end_i = j - 1
            end_t = times[end_i]
            dur = (end_t - start_t).total_seconds()
            st = stations[start_i]
            if st and dur >= min_duration_s:
                segments.append((st, start_t, end_t, start_i, end_i))
            i = j
        else:
            i += 1
    return segments

# --- Deceleration charts (final segment) -------------------------------------

def generate_deceleration_charts(times: List[datetime.datetime], speeds: List[float], stations: List[str], segments, dprev: list, output_prefix: str='speed_chart', threshold: float = DECEL_THRESHOLD_KMPH) -> None:
    """Create charts showing final deceleration from the LAST sample >= threshold before the zero-speed segment
    down to the FIRST zero sample (halt)."""
    try:
        import matplotlib.pyplot as plt  # type: ignore
    except Exception:
        return
    station_counts = {}
    for st, start_t, end_t, start_idx, end_idx in segments:  # start_idx is first zero
        station_counts[st] = station_counts.get(st, 0) + 1
        seq = station_counts[st]
        # Find the last 1km before stop using dprev
        dist_sum = 0.0
        decel_start = start_idx
        i = start_idx - 1
        while i >= 0 and dist_sum < 1000.0:
            dist = 0.0
            if len(dprev) > i:
                dist = dprev[i]
            dist_sum += dist
            decel_start = i
            i -= 1
        # If decel_start == start_idx, not enough data, skip
        if decel_start == start_idx:
            continue
        tw = times[decel_start:start_idx+1]
        sw = speeds[decel_start:start_idx+1]
        dseg = dprev[decel_start:start_idx+1] if len(dprev) >= start_idx+1 else [0]*(start_idx+1-decel_start)
        if not tw:
            continue
        max_speed = max(sw) if sw else 0
        first_speed = sw[0]
        # Calculate indices for last 120m and 60m before stop
        dist_cum = 0.0
        idx_120 = idx_60 = None
        for i in range(len(dseg)-1, -1, -1):
            dist_cum += dseg[i]
            if idx_120 is None and dist_cum >= 120:
                idx_120 = i
            if idx_60 is None and dist_cum >= 60:
                idx_60 = i
            if idx_120 is not None and idx_60 is not None:
                break
        try:
            import matplotlib.pyplot as plt  # ensure inside loop safe
        except Exception:
            return
        fig, ax = plt.subplots(figsize=(8,3))
        ax.plot(tw, sw, color='#ff7f0e', lw=1.5)
        ax.axvline(times[start_idx], color='red', ls='--', lw=0.9, label='Halt (0)')
        if idx_120 is not None and 0 <= idx_120 < len(tw):
            ax.axvline(tw[idx_120], color='blue', ls=':', lw=0.9, label='120m to stop')
        if idx_60 is not None and 0 <= idx_60 < len(tw):
            ax.axvline(tw[idx_60], color='green', ls=':', lw=0.9, label='60m to stop')
        from matplotlib.lines import Line2D
        custom_lines = [Line2D([0], [0], color='red', ls='--', lw=0.9, label='Halt (0)'),
                       Line2D([0], [0], color='blue', ls=':', lw=0.9, label='120m to stop'),
                       Line2D([0], [0], color='green', ls=':', lw=0.9, label='60m to stop')]
        ax.set_title(f'{st} Stop: Last 1km to 0 kmph')
        ax.set_xlabel('Time')
        ax.set_ylabel('Speed (km/h)')
        ax.grid(alpha=0.3)
        ax.text(tw[0], max_speed*0.9 if max_speed>0 else 0.1, f'Start {first_speed:.1f}', color='#ff7f0e', fontsize=8, ha='left')
        ax.text(times[start_idx], (max_speed*0.2) if max_speed>0 else 0.1, '0', color='red', fontsize=8, ha='right')
        ax.legend(handles=custom_lines, frameon=False, fontsize=8)
        fig.autofmt_xdate()
        out_base = f"{output_prefix}_{st}_{seq}_decel"
        exts = ['svg'] + (['png'] if PNG_OUTPUT else [])
        for ext in exts:
            fig.savefig(f'{out_base}.{ext}', dpi=150, bbox_inches='tight')
            if ext == 'svg':
                print('Wrote', f'{out_base}.{ext}')
        plt.close(fig)

# --- Overall chart -----------------------------------------------------------

def generate_chart(times: List[datetime.datetime], speeds: List[float], stations: List[str], output_prefix: str = 'speed_chart') -> List[tuple]:
    try:
        import matplotlib.pyplot as plt  # type: ignore
        from matplotlib.patches import Patch  # type: ignore
    except Exception as e:  # pragma: no cover
        write_fallback_summary(times, speeds, stations, output_prefix + '_summary.csv', missing_lib=str(e))
        print('matplotlib not available, wrote summary CSV instead.')
        return []
    if not times:
        print('No data to plot.')
        return []
    n = len(times)
    if n > 20000:
        step = math.ceil(n / 20000)
        times_ds = times[::step]
        speeds_ds = speeds[::step]
        stations_ds = stations[::step]
    else:
        times_ds, speeds_ds, stations_ds = times, speeds, stations
    fig = plt.figure(figsize=(12, 6), constrained_layout=True)
    gs = fig.add_gridspec(2, 1, height_ratios=[5, 0.6], hspace=0.05)
    ax = fig.add_subplot(gs[0])
    ax_stops = fig.add_subplot(gs[1], sharex=ax)
    ax.plot(times_ds, speeds_ds, lw=0.8, color='#1f77b4')
    ax.set_ylabel('Speed (km/h)')
    ax.set_title('Speed vs Time (Stop intervals below)')
    import matplotlib.pyplot as plt  # type: ignore
    plt.setp(ax.get_xticklabels(), visible=False)
    stop_indices_full = detect_station_stops(times, speeds, stations, MIN_STOP_DURATION_SECONDS)
    time_to_idx = {t: idx for idx, t in enumerate(times_ds)}
    ymax = max(speeds_ds) if speeds_ds else 1
    used_label_codes = set()
    for full_idx in stop_indices_full:
        t_full = times[full_idx]
        if t_full not in time_to_idx:
            continue
        ds_idx = time_to_idx[t_full]
        st_code = stations[full_idx]
        ax.axvline(times_ds[ds_idx], color='grey', lw=0.6, ls='--', alpha=0.6)
        if st_code and st_code not in used_label_codes:
            ax.text(times_ds[ds_idx], -ymax * 0.08, st_code, rotation=90, va='top', ha='center', fontsize=7, fontweight='bold', clip_on=False)
            used_label_codes.add(st_code)
    ax.grid(alpha=0.3)
    segments = detect_station_stop_segments(times, speeds, stations, MIN_STOP_DURATION_SECONDS)
    if segments:
        segments.sort(key=lambda x: x[1])
        # Make segments contiguous (no gaps) by extending each end to next start
        contiguous = []
        for i,(st,start_t,end_t,start_idx,end_idx) in enumerate(segments):
            if i < len(segments)-1:
                next_start = segments[i+1][1]
                new_end = next_start
            else:
                new_end = end_t
            contiguous.append((st,start_t,new_end,start_idx,end_idx))
        segments = contiguous
        station_order = []
        for seg in segments:
            st = seg[0]
            if st not in station_order:
                station_order.append(st)
        color_cycle = plt.rcParams['axes.prop_cycle'].by_key().get('color', ['#d62728','#2ca02c','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'])
        colors = {st: color_cycle[i % len(color_cycle)] for i, st in enumerate(station_order)}
        for st, start_t, end_t, _, _ in segments:
            ax_stops.plot([start_t, end_t], [0,0], lw=6, solid_capstyle='butt', color=colors[st])
        ax_stops.set_yticks([])
        ax_stops.set_xlabel('Time')
        ax_stops.set_xlim(times_ds[0], times_ds[-1])
        ax_stops.set_frame_on(False)
        ax_stops.grid(False)
        from matplotlib.patches import Patch  # type: ignore
        patches = [Patch(facecolor=colors[st], edgecolor='none', label=st) for st in station_order]
        legend = ax.legend(handles=patches, title='Stops', loc='lower center', bbox_to_anchor=(0.5, -0.02), ncol=min(6, len(patches)), fontsize=8, frameon=False)
        if legend.get_title():
            legend.get_title().set_fontweight('bold')
        for txt in legend.get_texts():
            txt.set_fontweight('bold')
    else:
        ax_stops.text(0.5,0.5,'No qualifying stops', transform=ax_stops.transAxes, ha='center', va='center', fontsize=8)
        ax_stops.set_yticks([])
        ax_stops.set_xlabel('Time')
        ax_stops.set_frame_on(False)
    fig.autofmt_xdate()
    exts = ['svg'] + (['png'] if PNG_OUTPUT else [])
    for ext in exts:
        out = f'{output_prefix}.{ext}'
        fig.savefig(out, dpi=150, bbox_inches='tight')
        if ext == 'svg':
            print('Wrote', out)
    plt.close(fig)
    return segments

# --- Fallback summary ---------------------------------------------------------

def write_fallback_summary(times: List[datetime.datetime], speeds: List[float], stations: List[str], out_csv: str, missing_lib: str):
    if not times:
        return
    import statistics
    nonzero = [s for s in speeds if s > 0]
    def pctl(data, p):
        if not data: return 0.0
        d = sorted(data)
        k = (len(d)-1) * p / 100
        f = int(k); c = min(f+1, len(d)-1)
        if f == c: return d[f]
        return d[f] + (d[c]-d[f]) * (k - f)
    summary = {
        'records_total': len(speeds),
        'records_moving': len(nonzero),
        'max_speed': max(nonzero) if nonzero else 0,
        'avg_moving_speed': round(statistics.mean(nonzero), 2) if nonzero else 0,
        'avg_overall_speed': round(statistics.mean(speeds), 2) if speeds else 0,
        'p95_speed': round(pctl(nonzero,95),2) if nonzero else 0,
        'stations_with_stops': '>'.join({seg[0] for seg in detect_station_stop_segments(times, speeds, stations, MIN_STOP_DURATION_SECONDS)}),
        'missing_matplotlib': missing_lib,
    }
    with open(out_csv, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['key','value'])
        for k,v in summary.items():
            w.writerow([k,v])
    print('Summary written to', out_csv)

# --- Main ---------------------------------------------------------------------

def main():
    path = find_input(sys.argv[1] if len(sys.argv) > 1 else None)
    print('Using input:', path)
    times, speeds, stations, dprev = parse_csv(path)
    if not times:
        print('No valid records parsed.')
        return
    segments = generate_chart(times, speeds, stations)
    if segments:
        generate_deceleration_charts(times, speeds, stations, segments, dprev)

if __name__ == '__main__':
    main()
