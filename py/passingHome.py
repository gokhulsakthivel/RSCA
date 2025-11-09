import sys, os, re
from typing import Optional
import csv, datetime

# Configuration defaults
MIN_STOP_DURATION_DEFAULT = 1  # seconds
INPUT_GLOB = '*PrimaryGPSData*.csv'

# --- Helpers -----------------------------------------------------------------

def extract_date_from_filename(fname: str):
    m = re.search(r'(20\d{2}-\d{2}-\d{2})', fname)
    if m:
        try:
            return datetime.date.fromisoformat(m.group(1))
        except ValueError:
            return None
    return None

def find_input(path_arg: Optional[str]) -> str:  # Python 3.9 compatible now
    if path_arg and os.path.isfile(path_arg):
        return path_arg
    import glob
    matches = sorted(glob.glob(INPUT_GLOB)) or sorted(glob.glob('*.csv'))
    if not matches:
        raise SystemExit('No CSV file found.')
    # Prefer one with 'modified'
    for m in matches:
        if 'modified' in m.lower():
            return m
    return matches[0]

# --- Argument parsing --------------------------------------------------------

def parse_args():
    import argparse
    p = argparse.ArgumentParser(description='Generate arrival(halt) table from CSV.')
    p.add_argument('csv', nargs='?', help='Input CSV file (optional). If omitted first matching file is used.')
    p.add_argument('--min-stop', type=int, default=MIN_STOP_DURATION_DEFAULT, help='Minimum zero-speed duration (s) to count as a halt (default: 30)')
    p.add_argument('--loco', default='', help='Loco number to include in table (optional)')
    p.add_argument('--date', default='', help='Override service date (YYYY-MM-DD). If omitted, extracted from filename or today.')
    return p.parse_args()

# --- Main logic --------------------------------------------------------------

def main():
    args = parse_args()
    path = find_input(args.csv)
    min_stop = args.min_stop
    loco_number = args.loco
    base_date = None
    if args.date:
        try:
            base_date = datetime.date.fromisoformat(args.date)
        except ValueError:
            print('Warning: invalid --date, falling back to filename/date.')
    if base_date is None:
        base_date = extract_date_from_filename(os.path.basename(path)) or datetime.date.today()
    
    prev_datetime = None  # Track previous datetime for continuity check

    with open(path, 'r', encoding='utf-8-sig') as f:
        r = csv.reader(f)
        header = next(r, [])
        header_map = {col.strip().lower(): idx for idx, col in enumerate(header)}
        rows = [row for row in r if row and any(c.strip() for c in row)]

    # Define expected columns (case-insensitive)
    col_dev = next((header_map[k] for k in header_map if k in ['device id', 'device_id', 'dev', 'device']), 0)
    col_time = next((header_map[k] for k in header_map if k in ['logging time', 'time', 'event_detection_time', 'event_time']), 1)
    col_speed = next((header_map[k] for k in header_map if k in ['speed', 'loco_speed', 'speed(kmph)']), 5)  # Use column 5 for 'Speed'
    col_lat = next((header_map[k] for k in header_map if k in ['latitude', 'lat']), 3)
    col_lon = next((header_map[k] for k in header_map if k in ['longitude', 'lon']), 4)
    col_station = next((header_map[k] for k in header_map if k in ['last/cur stationcode', 'station_code', 'station', 'stationname', 'station_name']), 8)

    def parse_time_flexible(time_val):
        # Support various datetime formats
        for fmt in (
            '%d/%m/%Y %H:%M',     # DD/MM/YYYY HH:mm (primary format)
            '%d/%m/%Y %H:%M:%S',  # DD/MM/YYYY HH:mm:ss
            '%Y-%m-%d %H:%M:%S',  # YYYY-MM-DD HH:mm:ss
            '%d/%m/%y %H:%M:%S',  # DD/MM/YY HH:mm:ss
            '%H:%M:%S',           # HH:mm:ss (fallback to base_date)
            '%H:%M',              # HH:mm (fallback to base_date)
            '%m/%d/%y %H:%M:%S',  # Legacy format
            '%m/%d/%Y %H:%M:%S',  # Legacy format
        ):
            try:
                parsed = datetime.datetime.strptime(time_val, fmt)
                if fmt == '%H:%M:%S':
                    # For time-only format, combine with base_date
                    return parsed.time()
                return parsed
            except Exception:
                continue
        return None

    records = []
    for row in rows:
        # Pad row if short
        if len(row) < len(header):
            row += [''] * (len(header) - len(row))
        time_val = row[col_time].strip()
        t_obj = parse_time_flexible(time_val)
        if t_obj is None:
            continue
        
        speed_str = row[col_speed].strip()
        try:
            sp = float(speed_str)
            if sp < 0.7:  # Handle very low speeds as zero
                sp = 0.0
        except Exception:
            continue

        # Handle datetime parsing
        if not isinstance(t_obj, datetime.datetime):
            # Skip records that don't have full datetime information
            continue
            
        dt = t_obj
        
        # Validate datetime continuity
        if prev_datetime is not None:
            if dt < prev_datetime:
                # Skip records that go backwards in time
                continue
                
        prev_datetime = dt

        records.append({
            'dev': row[col_dev].strip(),
            'datetime': dt,
            'time': dt.strftime('%H:%M:%S'),
            'speed': sp,
            'speed_raw': speed_str,
            'lat': row[col_lat].strip(),
            'lon': row[col_lon].strip(),
            'station': row[col_station].strip()
        })

    halt_stations=set()
    i=0; n=len(records)
    while i<n:
        rec = records[i]
        if rec['speed'] == 0.0 and rec['station']:
            st = rec['station']
            j = i + 1
            while j < n and records[j]['station'] == st and records[j]['speed'] == 0.0:
                j += 1
            t1 = records[i]['datetime']
            t2 = records[j - 1]['datetime']
            if (t2 - t1).total_seconds() >= min_stop:
                halt_stations.add(st)
            i = j
        else:
            i += 1

    seen=set(); arrivals=[]
    for rec in records:
        st=rec['station']
        if not st or st not in halt_stations or st in seen:
            continue
        seen.add(st)
        arrivals.append(rec)

    # Output table
    cols=['DEVICE_ID','LOCO_NUMBER','LOCO_SPEED','STATION_CODE','EVENT_DETECTION_TIME','EVENT_TYPE_FLAG','LATITUDE','LONGITUDE']
    print('| ' + ' | '.join(cols) + ' |')
    print('|' + '|'.join(['-'*(len(c)+2) for c in cols]) + '|')
    date_prefix = base_date.isoformat()
    for r in arrivals:
        event_time = r['datetime'].strftime('%Y-%m-%d %H:%M:%S')
        print('| {} | {} | {} | {} | {} | {} | {} | {} |'.format(
            r['dev'], loco_number, r['speed_raw'], r['station'], event_time, 'ARRIVAL(HALT)', r['lat'], r['lon']))

if __name__ == '__main__':
    main()