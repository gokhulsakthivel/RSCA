import sys, os, re
from typing import Optional
import csv, datetime

# Configuration defaults
MIN_STOP_DURATION_DEFAULT = 30  # seconds
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

    with open(path,'r',encoding='utf-8-sig') as f:
        r=csv.reader(f)
        header=next(r, [])
        rows=[row for row in r if row and any(c.strip() for c in row)]

    records=[]
    for row in rows:
        if len(row)<9:
            continue
        try:
            datetime.datetime.strptime(row[1].strip(),'%H:%M:%S')
        except Exception:
            continue
        speed_str=row[2].strip()
        try:
            sp=float(speed_str)
        except Exception:
            continue
        records.append({
            'dev':row[0].strip(),
            'time':row[1].strip(),
            'speed':sp,
            'speed_raw':speed_str,
            'lat':row[3].strip(),
            'lon':row[4].strip(),
            'station':row[8].strip()
        })

    halt_stations=set()
    i=0; n=len(records)
    while i<n:
        rec=records[i]
        if rec['speed']==0 and rec['station']:
            st=rec['station']
            j=i+1
            while j<n and records[j]['station']==st and records[j]['speed']==0:
                j+=1
            t1=datetime.datetime.strptime(records[i]['time'],'%H:%M:%S')
            t2=datetime.datetime.strptime(records[j-1]['time'],'%H:%M:%S')
            if (t2-t1).total_seconds()>=min_stop:
                halt_stations.add(st)
            i=j
        else:
            i+=1

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
        event_time = f"{date_prefix} {r['time']}"
        print('| {} | {} | {} | {} | {} | {} | {} | {} |'.format(
            r['dev'], loco_number, r['speed_raw'], r['station'], event_time, 'ARRIVAL(HALT)', r['lat'], r['lon']))

if __name__ == '__main__':
    main()