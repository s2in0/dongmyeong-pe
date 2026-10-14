"""Export reproducible pose tracks for the JavaScript classroom counter.

python tools/extract_web_pose_tracks.py local.mp4 --source-url URL --manual-count 12 --end 8.48 --out track.json
Count annotations must come from visual review of the original video, never counter output.
This exports CPU/lite inference; it does not claim to reproduce an iPad's GPU or dropped frames.
"""
import argparse,json
from pathlib import Path
from evaluate import extract_series

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('video',type=Path);ap.add_argument('--source-url',required=True)
    ap.add_argument('--manual-count',type=int,required=True);ap.add_argument('--start',type=float,default=0)
    ap.add_argument('--end',type=float,required=True);ap.add_argument('--source-offset',type=float,default=0)
    ap.add_argument('--out',type=Path,required=True);ap.add_argument('--cache-dir',type=Path,default=Path('.cache'))
    args=ap.parse_args()
    if not 0<=args.start<args.end or args.manual_count<0:ap.error('Invalid time window or manual count')
    series=extract_series(args.video,'lite',args.cache_dir,720)
    indices=[0,7,8,11,12,23,24,27,28]
    frames=[[round(t-args.start,6),None if lms is None else [[round(v,6)for v in lms[i]]for i in indices]]for t,lms in series['frames']if args.start<=t<args.end]
    data={'source':args.source_url,'sourceOffset':args.source_offset,'start':args.start,'end':args.end,
          'model':'MediaPipe Pose Landmarker lite float16 / Tasks 1.0.1 CPU','inferenceMaxSide':720,
          'width':series['width'],'height':series['height'],'fps':series['fps'],
          'manualCount':args.manual_count,'annotation':'Visual count from source footage; source slow motion retained.',
          'indices':indices,'frames':frames}
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
    print(f'Exported {len(frames)} frames to {args.out}')

if __name__=='__main__':main()
