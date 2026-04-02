import json

raw = open('data.txt', 'r', encoding='utf-8').read().strip()

raw_fixed = raw.replace('\\,', ',')

decoded = raw_fixed.encode('utf-8').decode('unicode_escape')
obj = json.loads(decoded)

output = json.dumps(obj, indent=2)
print(output)

with open('recons.json', 'w', encoding='utf-8') as f:
    f.write(output)
