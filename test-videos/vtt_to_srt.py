#!/usr/bin/env python3
"""Convert YouTube auto-generated VTT to clean SRT, stripping inline timing/tags."""
import re
import sys

def vtt_to_srt(vtt_path, srt_path):
    with open(vtt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove WEBVTT header and metadata
    lines = content.split('\n')
    # Skip header lines until we find first timestamp
    segments = []
    current_start = None
    current_end = None
    current_text = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Look for timestamp line
        m = re.match(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})', line)
        if m:
            # Save previous segment if it has text
            if current_start is not None and current_text:
                text = ' '.join(current_text).strip()
                if text:
                    segments.append((current_start, current_end, text))
            current_start = m.group(1)
            current_end = m.group(2)
            current_text = []
            i += 1
            # Read text lines until next timestamp or empty
            while i < len(lines):
                tline = lines[i].strip()
                if re.match(r'\d{2}:\d{2}:\d{2}\.\d{3}\s*-->', tline):
                    break
                if tline:
                    # Remove inline timing tags like <00:00:01.079>
                    clean = re.sub(r'<[^>]+>', '', tline)
                    if clean.strip():
                        current_text.append(clean.strip())
                i += 1
        else:
            i += 1
    
    # Save last segment
    if current_start is not None and current_text:
        text = ' '.join(current_text).strip()
        if text:
            segments.append((current_start, current_end, text))
    
    # Merge consecutive segments with same text (YouTube repeats)
    merged = []
    for seg in segments:
        if merged and merged[-1][2] == seg[2]:
            # Extend end time
            merged[-1] = (merged[-1][0], seg[1], seg[2])
        else:
            merged.append(list(seg))
    
    # Remove very short segments (noise)
    merged = [s for s in merged if s[2] and len(s[2]) > 1]
    
    # Write SRT
    with open(srt_path, 'w', encoding='utf-8') as f:
        for idx, (start, end, text) in enumerate(merged, 1):
            # Convert . to , for SRT
            start_srt = start.replace('.', ',')
            end_srt = end.replace('.', ',')
            f.write(f"{idx}\n{start_srt} --> {end_srt}\n{text}\n\n")
    
    print(f"Converted {len(merged)} segments to {srt_path}")

if __name__ == '__main__':
    vtt_to_srt(sys.argv[1], sys.argv[2])
