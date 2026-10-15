#!/bin/bash
# 30 天模拟矩阵：策略 × 种子，输出每格 JSON 与按策略平均的表（用法：scripts/sim-matrix.sh [策略...]）
cd "$(dirname "$0")/.."
STRATS=${@:-base train scenes}
OUT=${SIM_MATRIX_OUT:-/tmp/simmatrix}
mkdir -p $OUT
SEEDS=${SIM_SEEDS:-42 7 99}
for st in $STRATS; do for s in $SEEDS; do
  (SIM_OUT=$OUT/$st-$s.txt ./node_modules/.bin/tsx scripts/sim-30days.ts $s $st 2>&1 | grep '^SIMJSON' | sed 's/^SIMJSON //' > $OUT/$st-$s.json) &
done; done; wait
SEEDS_PY="$SEEDS" python3 - "$OUT" $STRATS <<'PY'
import json,sys,os
out=sys.argv[1]; strats=sys.argv[2:]; seeds=os.environ['SEEDS_PY'].split()
print('| 策略 | 金币(各种子) | 平均金币 | 金币+投资 | 接客收入 | 满意度 | 极乐 | 满意 | 回头客 | 接客/调教 | 头牌≥50项 | 头牌≥75项 | 有≥50技能的人 | 头牌接客占比 |')
print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for st in strats:
    R=[json.load(open(f'{out}/{st}-{s}.json')) for s in seeds]
    a=lambda k: round(sum(r[k] for r in R)/len(R),1)
    print(f"| {st} | {'/'.join(str(r['gold']) for r in R)} | {a('gold'):.0f} | {a('worth'):.0f} | {a('income'):.0f} | {a('sat')} | {a('gokuraku')} | {a('manzoku')} | {a('regulars')} | {a('services')}/{a('trainings')} | {a('top50')} | {a('top75')} | {a('girls50')} | {a('topShare')}% |")
PY
