import pathlib,subprocess,re,json,hashlib,collections
root=pathlib.Path('outputs/homey-backup-center'); out=root/'docs/provenance'
ours={p:subprocess.check_output(['git','-C',str(root),'show','origin/main:'+p]).decode(errors='replace') for p in subprocess.check_output(['git','-C',str(root),'ls-tree','-r','--name-only','origin/main']).decode().splitlines() if p.endswith(('.js','.html')) and not p.startswith('test/')}
pattern=re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_$][\w$]*|\d+|[^\s]')
def tokens(s):return [m.group() for m in pattern.finditer(s) if not m.group().startswith(('//','/*'))]
index=collections.defaultdict(list);N=20
for p,s in ours.items():
 ts=tokens(s)
 for i in range(len(ts)-N+1):index[tuple(ts[i:i+N])].append((p,i))
summary=[]
for name,repo in [('flow-version-history',pathlib.Path('/Users/dennisweel/Documents/Codex/2026-09-15/referenced-chatgpt-conversation-this-is-an-4/work/sven')),('homey-backups',pathlib.Path('work/homey-backups'))]:
 def git(*args):return subprocess.check_output(['git','-C',str(repo),*args])
 commits=git('rev-list','--all').decode().splitlines();blobs={};matches=[]
 for c in commits:
  for line in git('ls-tree','-r',c).decode().splitlines():
   meta,p=line.split('\t');h=meta.split()[2]
   if p.endswith(('.js','.html','.py')) and not any(x in p for x in ['vendor','jquery','tests/']):blobs.setdefault((h,p),c)
 for (h,p),c in blobs.items():
  s=git('cat-file','blob',h).decode(errors='replace');ts=tokens(s);found={}
  for i in range(len(ts)-N+1):
   block=tuple(ts[i:i+N])
   if block in index:
    for q,j in index[block]:found.setdefault(q,[]).append({'sourceToken':i,'oursToken':j,'excerpt':' '.join(block)})
  for q,rows in found.items():matches.append({'source':p,'blob':h,'commit':c,'ours':q,'windows':len(rows),'examples':rows[:3]})
 result={'project':name,'head':git('rev-parse','HEAD').decode().strip(),'commits':len(commits),'historicalCodeBlobs':len(blobs),'windowSize':N,'matches':matches}
 (out/(name+'.json')).write_text(json.dumps(result,indent=2));summary.append({k:v for k,v in result.items() if k!='matches'}|{'matchingPairs':len(matches)})
print(json.dumps(summary,indent=2))
