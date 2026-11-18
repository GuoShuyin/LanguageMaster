#!/usr/bin/env python3
"""Convert Whisper JSON output to SRT file."""
import json
import sys

def whisper_to_srt(json_path, srt_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        segments = json.load(f)
    
    with open(srt_path, 'w', encoding='utf-8') as f:
        for i, seg in enumerate(segments, 1):
            start = sec_to_srt(seg['start'])
            end = sec_to_srt(seg['end'])
            f.write(f"{i}\n{start} --> {end}\n{seg['japanese']}\n\n")
    
    print(f"Converted {len(segments)} segments to {srt_path}")

def sec_to_srt(sec):
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

if __name__ == '__main__':
    whisper_to_srt(sys.argv[1], sys.argv[2])
