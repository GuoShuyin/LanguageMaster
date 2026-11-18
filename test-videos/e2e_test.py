#!/usr/bin/env python3
"""
End-to-end test simulating a real user workflow:
1. Load settings (verify API keys present)
2. Parse Japanese subtitle file
3. Process subtitles with Claude (furigana + translation)
4. Verify furigana format (漢字[かんじ])
5. Verify Chinese translation
6. Add review items by selecting text
7. List review book
8. Export Anki cards
9. Test Whisper ASR
"""
import json
import urllib.request
import urllib.parse
import sys
import os

BASE = "http://localhost:3001/api"

def api_call(method, path, data=None, files=None):
    url = f"{BASE}{path}"
    if files:
        # Multipart form for file upload
        import subprocess
        cmd = ["curl", "-s", "-X", "POST", url]
        for key, value in files.items():
            if key == "video":
                cmd.extend(["-F", f"video=@{value}"])
            else:
                cmd.extend(["-F", f"{key}={value}"])
        result = subprocess.run(cmd, capture_output=True, text=True)
        return json.loads(result.stdout)
    elif data is not None:
        req = urllib.request.Request(url, data=json.dumps(data).encode(), method=method,
                                     headers={"Content-Type": "application/json"})
    else:
        req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR ({e.code}): {body}")
        return json.loads(body)

def main():
    passed = 0
    failed = 0
    
    def check(name, condition, detail=""):
        nonlocal passed, failed
        if condition:
            print(f"  ✓ {name}")
            passed += 1
        else:
            print(f"  ✗ {name} {detail}")
            failed += 1
    
    print("=" * 60)
    print("LanguageMaster 端到端测试")
    print("=" * 60)
    
    # ===== Test 1: Settings =====
    print("\n[1] 加载设置")
    settings = api_call("GET", "/settings")
    check("Claude API Key 已配置", bool(settings.get("claudeApiKey")))
    check("OpenAI API Key 已配置", bool(settings.get("openaiApiKey")))
    check("Claude 模型已配置", bool(settings.get("claudeModel")))
    print(f"    模型: {settings.get('claudeModel')}")
    
    # ===== Test 2: Parse subtitles =====
    print("\n[2] 解析字幕文件")
    srt_path = os.path.join(os.path.dirname(__file__), "doraemon_ja.srt")
    with open(srt_path, "r", encoding="utf-8") as f:
        srt_content = f.read()
    segments = api_call("POST", "/subtitles/parse", {
        "content": srt_content,
        "fileName": "doraemon_ja.srt"
    })
    check("字幕解析返回数组", isinstance(segments, list))
    check(f"解析出 {len(segments)} 条字幕", len(segments) > 0)
    check("字幕有时间戳", all("start" in s and "end" in s for s in segments))
    check("字幕有日文文本", any(s.get("japanese") for s in segments))
    
    # ===== Test 3: Claude processing (furigana + translation) =====
    print("\n[3] Claude 处理字幕（注音 + 翻译）")
    # Use first 5 segments to save API cost
    test_segments = segments[:5]
    results = api_call("POST", "/claude/process", {
        "segments": test_segments,
        "settings": settings,
        "options": {"translate": True, "furigana": True}
    })
    check("Claude 返回结果数组", isinstance(results, list))
    check(f"返回 {len(results)} 条结果", len(results) == len(test_segments))
    
    # Check furigana format
    has_furigana = any(r.get("furigana") and "[" in r["furigana"] for r in results)
    check("注音包含 [reading] 格式", has_furigana)
    
    # Check Chinese translation
    has_chinese = any(r.get("chinese") for r in results)
    check("包含中文翻译", has_chinese)
    
    # Show sample
    for r in results[:3]:
        furigana = r.get("furigana", "")
        chinese = r.get("chinese", "")
        print(f"    ID {r['id']}: furigana={furigana[:50]} | chinese={chinese[:30]}")
    
    # ===== Test 4: Review book - Add items =====
    print("\n[4] 添加复习条目")
    # Clear first
    api_call("DELETE", "/review")
    
    # Add items as if user selected text
    item1 = api_call("POST", "/review", {
        "text": "勉強",
        "japanese": "勉強しに行くんだから",
        "chinese": "因为要去学习",
        "furigana": "勉強[べんきょう]しに行くんだから",
        "videoFileName": "doraemon_full.mp4",
        "timestamp": 38.4
    })
    check("添加复习条目1", len(item1) == 1)
    
    item2 = api_call("POST", "/review", {
        "text": "友達",
        "japanese": "気の合った友達とでなくちゃ",
        "chinese": "不和合得来的朋友一起的话",
        "furigana": "気[き]の合った友達[ともだち]とでなくちゃ",
        "videoFileName": "doraemon_full.mp4",
        "timestamp": 43.6
    })
    check("添加复习条目2", len(item2) == 2)
    
    # ===== Test 5: List review book =====
    print("\n[5] 查看复习本")
    review = api_call("GET", "/review")
    check("复习本有2条", len(review) == 2)
    check("条目有ID", all("id" in r for r in review))
    check("条目有创建时间", all("createdAt" in r for r in review))
    for r in review:
        print(f"    - {r['text']} | {r.get('chinese','')} | 来源: {r.get('videoFileName','')}")
    
    # ===== Test 6: Remove review item =====
    print("\n[6] 删除复习条目")
    first_id = review[0]["id"]
    after_remove = api_call("DELETE", f"/review/{first_id}")
    check("删除后剩1条", len(after_remove) == 1)
    
    # ===== Test 7: Anki export =====
    print("\n[7] 导出 Anki 卡片")
    import subprocess
    result = subprocess.run([
        "curl", "-s", "-X", "POST", f"{BASE}/anki/export",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(after_remove)
    ], capture_output=True, text=True)
    tsv = result.stdout
    check("Anki 导出非空", len(tsv) > 0)
    check("包含表头", "#Expression" in tsv)
    check("包含数据行", "友達" in tsv)
    print(f"    TSV 内容预览:\n    {tsv.strip()[:200]}")
    
    # ===== Test 8: Whisper ASR =====
    print("\n[8] Whisper 语音转文字")
    clip_path = os.path.join(os.path.dirname(__file__), "doraemon_clip.mp4")
    if os.path.exists(clip_path):
        whisper_result = api_call("POST", "/whisper/transcribe", files={
            "video": clip_path,
            "settings": json.dumps(settings)
        })
        check("Whisper 返回结果", isinstance(whisper_result, list))
        check(f"识别出 {len(whisper_result)} 段", len(whisper_result) > 0)
        check("包含日文文本", any(s.get("japanese") for s in whisper_result))
        for s in whisper_result[:3]:
            print(f"    [{s['start']:.1f}-{s['end']:.1f}] {s.get('japanese','')[:40]}")
    else:
        print("    跳过 (测试视频不存在)")
    
    # ===== Test 9: Clear review book =====
    print("\n[9] 清空复习本")
    cleared = api_call("DELETE", "/review")
    check("复习本已清空", len(cleared) == 0)
    
    # ===== Summary =====
    print("\n" + "=" * 60)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print("=" * 60)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
