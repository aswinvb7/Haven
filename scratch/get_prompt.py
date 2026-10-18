import json

with open(r'C:\Users\user\.gemini\antigravity\brain\7307369e-bcf0-4601-8f1c-fe8613c45132\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    inputs = []
    for line in f:
        try:
            d = json.loads(line)
            if d.get('type') == 'USER_INPUT':
                inputs.append(d.get('content'))
        except Exception:
            pass

if inputs:
    print(inputs[-1])
