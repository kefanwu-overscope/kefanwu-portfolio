"""Keep source identity and hashes public without publishing host paths."""
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def public_value(value):
    if isinstance(value,dict):
        return {public_value(key):public_value(item) for key,item in value.items()}
    if isinstance(value,list):return [public_value(item) for item in value]
    if not isinstance(value,str) or not re.search(r'[A-Za-z]:[\\/]',value):return value
    text=value.replace('\\','/')
    for prefix,replacement in [(str(ROOT).replace('\\','/')+'/',''),
                                (str(ROOT.parent).replace('\\','/')+'/','workspace/'),
                                (str(ROOT.parent.parent).replace('\\','/')+'/','archived-source/')]:
        text=re.sub(re.escape(prefix),lambda _:replacement,text,flags=re.IGNORECASE)
    text=re.sub(r'[A-Za-z]:/Users/[^/]+/','local-source/',text,flags=re.IGNORECASE)
    text=re.sub(r'[A-Za-z]:/','local-source/',text)
    return text


def sanitize_packages():
    evidence=ROOT.parent/'.codex/studio-v2-20260919/exports'
    changed=[]
    for path in (ROOT/'assets/studio-motion').glob('*/manifest.json'):
        value=json.loads(path.read_text(encoding='utf-8'))
        safe=public_value(value)
        if safe!=value:
            path.write_text(json.dumps(safe,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            changed.append(path.parent.name)
        audit_path=evidence/(path.parent.name+'-audit.json')
        audit=json.loads(audit_path.read_text(encoding='utf-8'))
        audit['manifestSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
        audit['publicProvenancePolicy']='Host paths replaced with repository/workspace/archive-relative source labels; complete paths retained only in this private audit.'
        audit_path.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'sanitizedProjects':changed}))


if __name__=='__main__':sanitize_packages()
