#!/usr/bin/env python3
"""Generate a single-row summary table from a GPS Primary GPS Data CSV.

Fields:
  LOCO_PILOT        Derived from filename (text before 'PrimaryGPSData'). Override with --pilot.
  TRAIN_NUMBER      Default from Device Id (first non-empty value). Override with --train.
  LOCO_NUMBER       Passed via --loco (optional).
  SECTION           First station code (non-empty) ' - ' last station code (non-empty).
  DATE              Run/service date (from filename date token YYYY-MM-DD or --date or today).
  TIMING            First timestamp ' - ' last timestamp in file.

Output: Markdown table printed to stdout.

Usage:
  python baseInfo.py path/to/data.csv [--pilot NAME] [--train NUM] [--loco NUM] [--date YYYY-MM-DD]
"""
import os, sys, re, csv, datetime
from typing import Optional

def extract_date_from_filename(fname: str) -> Optional[datetime.date]:
    m = re.search(r'(20\d{2}-\d{2}-\d{2})', fname)
    if m:
        try:
            return datetime.date.fromisoformat(m.group(1))
        except ValueError:
            return None
    return None

def extract_pilot_name(csv_path: str) -> str:
    base = os.path.basename(csv_path)
    base_no_ext = os.path.splitext(base)[0]
    idx = base_no_ext.lower().find('primarygpsdata')
    prefix = base_no_ext[:idx] if idx != -1 else base_no_ext
    prefix = prefix.replace('_',' ').replace('-',' ')
    parts = re.findall(r'[A-Za-z]+', prefix)
    if not parts:
        return 'Unknown'
    cleaned = [p.upper() if len(p)==1 else p.capitalize() for p in parts]
    # Remove common generic tokens
    filtered = [p for p in cleaned if p.lower() not in {'j','primary','gps','data'}]
    return ' '.join(filtered) if filtered else ' '.join(cleaned)

def parse_csv(path: str):
    def parse_time_flexible(time_val):
        # Try %H:%M:%S first
        try:
            return datetime.datetime.strptime(time_val, '%H:%M:%S').time(), '%H:%M:%S'
        except Exception:
            pass
        # Try %m/%d/%y %H:%M or %m/%d/%y %H:%M:%S
        for fmt in ('%m/%d/%y %H:%M', '%m/%d/%y %H:%M:%S', '%m/%d/%Y %H:%M', '%m/%d/%Y %H:%M:%S'):
            try:
                return datetime.datetime.strptime(time_val, fmt).time(), fmt
            except Exception:
                continue
        return None, None

    first_time = None
    last_time = None
    first_station = None
    last_station = None
    device_id = None
    with open(path,'r',encoding='utf-8-sig', newline='') as f:
        r = csv.reader(f)
        header = next(r, [])
        for row in r:
            if not row or all(not c.strip() for c in row):
                continue
            # Expect at least 9 cols
            if len(row) < 9:
                continue
            dev = row[0].strip()
            t_str = row[1].strip()
            station = row[8].strip()
            if dev and device_id is None:
                device_id = dev
            if t_str:
                t_obj, fmt = parse_time_flexible(t_str)
                if t_obj is not None:
                    t_fmt = t_obj.strftime('%H:%M:%S')
                    if first_time is None:
                        first_time = t_fmt
                    last_time = t_fmt
            if station:
                if first_station is None:
                    first_station = station
                last_station = station
    return device_id, first_time, last_time, first_station, last_station

def main():
    import argparse
    ap = argparse.ArgumentParser(description='Produce base run info table from GPS CSV.')
    ap.add_argument('csv', help='Input CSV file')
    ap.add_argument('--pilot', default='', help='Override pilot name')
    ap.add_argument('--train', default='', help='Override train number')
    ap.add_argument('--loco', default='', help='Loco number')
    ap.add_argument('--date', default='', help='Override date YYYY-MM-DD')
    args = ap.parse_args()

    if not os.path.isfile(args.csv):
        print('File not found:', args.csv)
        sys.exit(1)

    # Pilot
    pilot = args.pilot or extract_pilot_name(args.csv)

    # Date
    if args.date:
        try:
            run_date = datetime.date.fromisoformat(args.date)
        except ValueError:
            print('Warning: invalid --date, using filename / today')
            run_date = extract_date_from_filename(os.path.basename(args.csv)) or datetime.date.today()
    else:
        run_date = extract_date_from_filename(os.path.basename(args.csv)) or datetime.date.today()

    device_id, first_time, last_time, first_station, last_station = parse_csv(args.csv)

    train_number = args.train or (device_id or '')
    loco_number = args.loco
    section = ''
    if first_station and last_station:
        section = f'{first_station} - {last_station}'
    elif first_station:
        section = f'{first_station} - {first_station}'
    date_str = run_date.isoformat()
    timing = ''
    if first_time and last_time:
        timing = f'{first_time} - {last_time}'

    headers = ['LOCO_PILOT','TRAIN_NUMBER','LOCO_NUMBER','SECTION','DATE','TIMING']
    row = [pilot, train_number, loco_number, section, date_str, timing]

    # Markdown table output
    print('| ' + ' | '.join(headers) + ' |')
    print('|' + '|'.join(['-'*(len(h)+2) for h in headers]) + '|')
    print('| ' + ' | '.join(row) + ' |')

if __name__ == '__main__':
    main()
