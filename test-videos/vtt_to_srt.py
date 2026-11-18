#!/usr/bin/env python3
"""
Convert YouTube auto-generated VTT to clean SRT.
- Strips inline timing tags
- Merges consecutive overlapping/repeated segments into clean sentences
- Removes [音楽] and other bracketed non-speech markers from display text
"""
import re
import sys


def vtt_to_srt(vtt_path, srt_path):
    with open(vtt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    segments = []
    current_start = None
    current_end = None
    current_text = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        m = re.match(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})', line)
        if m:
            if current_start is not None and current_text:
                text = ' '.join(current_text).strip()
                if text:
                    segments.append((current_start, current_end, text))
            current_start = m.group(1)
            current_end = m.group(2)
            current_text = []
            i += 1
            while i < len(lines):
                tline = lines[i].strip()
                if re.match(r'\d{2}:\d{2}:\d{2}\.\d{3}\s*-->', tline):
                    break
                if tline:
                    clean = re.sub(r'<[^>]+>', '', tline)
                    if clean.strip():
                        current_text.append(clean.strip())
                i += 1
        else:
            i += 1

    if current_start is not None and current_text:
        text = ' '.join(current_text).strip()
        if text:
            segments.append((current_start, current_end, text))

    # Now merge overlapping/repeated segments
    # YouTube auto-subs repeat text in consecutive segments as new words are added.
    # Strategy: if a segment's text is a prefix of the next segment, merge them
    # and use the longer text. Keep the earliest start and latest end.
    merged = []
    for seg in segments:
        start, end, text = seg
        if merged:
            prev_start, prev_end, prev_text = merged[-1]
            # Check if current text starts with previous text (continuation)
            # or if previous text starts with current text (repeat)
            if text.startswith(prev_text):
                # Current segment extends the previous one — replace
                merged[-1] = (prev_start, end, text)
                continue
            elif prev_text.startswith(text):
                # Current is a subset of previous — skip (it's a repeat)
                # But update end time
                merged[-1] = (prev_start, end, prev_text)
                continue
            # Check overlap: if texts share a common suffix/prefix
            # Simple heuristic: if more than 60% of chars match, merge
            overlap = longest_common_prefix(prev_text, text)
            if len(overlap) > len(prev_text) * 0.5:
                # Significant overlap — take the longer text
                if len(text) > len(prev_text):
                    merged[-1] = (prev_start, end, text)
                else:
                    merged[-1] = (prev_start, end, prev_text)
                continue
        merged.append((start, end, text))

    # Now split merged segments into sentences at natural breakpoints
    # (。、！？and long pauses) to make subtitles more readable
    final_segments = []
    for start, end, text in merged:
        # Remove [音楽] etc but keep as marker if it's the only content
        clean_text = re.sub(r'\[.*?\]', '', text).strip()
        if not clean_text:
            # Only had [音楽] etc — skip
            continue
        if clean_text != text:
            # Had bracket markers, use cleaned version
            text = clean_text
        # Split into sentences at Japanese punctuation
        sentences = re.split(r'(?<=[。！？])', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) <= 1:
            final_segments.append((start, end, text))
        else:
            # Distribute time across sentences proportionally
            total_chars = sum(len(s) for s in sentences)
            start_sec = time_to_sec(start)
            end_sec = time_to_sec(end)
            duration = end_sec - start_sec
            for s in sentences:
                frac = len(s) / total_chars
                seg_end = start_sec + duration * frac
                final_segments.append((sec_to_time(start_sec), sec_to_time(seg_end), s))
                start_sec = seg_end

    # Remove very short segments
    final_segments = [s for s in final_segments if len(s[2]) > 1]

    # Write SRT
    with open(srt_path, 'w', encoding='utf-8') as f:
        for idx, (start, end, text) in enumerate(final_segments, 1):
            start_srt = start.replace('.', ',')
            end_srt = end.replace('.', ',')
            f.write(f"{idx}\n{start_srt} --> {end_srt}\n{text}\n\n")

    print(f"Converted {len(final_segments)} segments to {srt_path}")


def longest_common_prefix(a, b):
    """Find the longest string that is a prefix of both a and b."""
    result = ""
    for i in range(min(len(a), len(b))):
        if a[i] == b[i]:
            result += a[i]
        else:
            break
    return result


def time_to_sec(t):
    h, m, s = t.split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def sec_to_time(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}"


if __name__ == '__main__':
    vtt_to_srt(sys.argv[1], sys.argv[2])
