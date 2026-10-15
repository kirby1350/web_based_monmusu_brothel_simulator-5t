// 重油文风的词库（只进提示词）：拟声 / 体液 / 触感 / 温度 / 气味 / 部位别称 / 淫语 / 动作 / 修饰前缀。
// 每回合按当前步骤筛（前面的步骤不给性器与体液，高潮类只在高潮档给），再抽一部分，避开最近用过的，让措辞每回合都换。

/** step：这一步起才可用（0 迎客 … 3 正戏）；climax：只在有人到「高潮」档时给 */
export interface BankWord { w: string; step?: number; climax?: boolean }
const W = (list: string, step = 0, climax = false): BankWord[] => list.split(/\s+/).filter(Boolean).map((w) => ({ w, step, climax }))

export const PROSE_BANK: Record<string, { label: string; pick: number; words: BankWord[] }> = {
  sound: { label: '拟声', pick: 5, words: [
    ...W('啾 啵 咕嘟 嘶哈 哈啊 呼哧 嘤咛 窸窣 沙沙 叮铃 吱呀 咂 吧唧 咕噜 唔嗯'),
    ...W('咕啾 噗滋 滋溜 咕叽 啾噜 黏答答 嗞啾', 2),
    ...W('啪啪 啪嗒 噗啾 咕唧咕唧 噗嗤', 3),
  ] },
  fluid: { label: '体液与湿度', pick: 4, words: [
    ...W('香汗 涎丝 银丝 汗珠 湿痕 水光 黏丝'),
    ...W('蜜液 爱液 淫水 前液 湿漉漉的腿根 拉丝的蜜', 2),
    ...W('白浊 精浆 潮水 浓稠的精 溢出的白', 3, true),
  ] },
  touch: { label: '触感', pick: 6, words: W('软糯 绵密 弹嫩 滑腻 黏稠 湿濡 紧致 肥厚 丰腴 酥软 细腻 温润 厚实 鼓胀 紧绷 颤巍巍 沉甸甸 肉乎乎 油亮 雪腻 脂滑 绵软 肥嫩 Q弹') },
  temp: { label: '温度', pick: 3, words: W('滚烫 灼热 温热 热乎乎 烫人 暖融融 蒸腾 凉滑 冰凉 微烫 热辣') },
  smell: { label: '气味', pick: 3, words: [
    ...W('奶香 甜腻体香 汗香 脂粉香 熟果般的甜香 皂角香 发丝的香 酒气'),
    ...W('雌香 发情的腥甜 麝香 荷尔蒙气息 潮湿的雌味 腥膻', 2),
  ] },
  part: { label: '部位别称', pick: 7, words: [
    ...W('雪腻乳肉 肥软奶球 乳峰 乳沟 蜜桃臀 肥臀 臀肉 丝腿 大腿根 腿弯 足弓 玉足 柳腰 腰窝 樱唇 软舌 香舌 檀口 锁骨窝 耳垂 后颈'),
    ...W('奶尖 乳晕 臀缝 花唇 花核 穴口 肉缝 肉棒 龟头 柱身 马眼 囊袋 青筋', 2),
    ...W('蜜穴 蜜壶 宫口 内壁 褶皱 最深处', 3),
  ] },
  verb: { label: '动作', pick: 5, words: [
    ...W('揉 捏 搓 蹭 贴 裹 舔 吮 嘬 咂 含 抚 摩挲'),
    ...W('挤 夹 磨 撸 套弄 吸吮', 2),
    ...W('顶 碾 绞 吞 夯 撞 研磨 抽送', 3),
  ] },
  voice: { label: '淫语', pick: 3, words: [
    ...W('「再靠近一点嘛」 「都被你看光了……」 「好热……」 「别、别盯着看呀」 「心跳好快……」'),
    ...W('「那里……不可以……」 「手指好烫……」 「湿、湿掉了……」 「再、再用力一点」', 2),
    ...W('「里面……全是你的形状」 「要被顶坏了」 「不要停……」 「好深……」 「要、要去了——」', 3),
  ] },
  mod: { label: '修饰前缀（叠在部位前）', pick: 6, words: W('肥 厚 脂 油 腻 糯 雪 嫩 软 熟 湿 烫 沉 鼓 颤 香 粉 红') },
}

/** 简单可复现的随机（同一回合同一组） */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
}

export interface BankOpts { stepIndex: number; climaxAllowed: boolean; seed: number; avoid?: string[] }

/** 这一回合可用的词：按步骤与高潮档筛 */
export function availableWords(cat: string, o: Pick<BankOpts, 'stepIndex' | 'climaxAllowed'>): string[] {
  return PROSE_BANK[cat].words.filter((x) => (x.step ?? 0) <= o.stepIndex && (!x.climax || o.climaxAllowed)).map((x) => x.w)
}

/** 每类抽 pick 个，先避开最近用过的；不够再补 */
export function sampleBank(o: BankOpts): Record<string, string[]> {
  const r = rng(o.seed + o.stepIndex * 101)
  const avoid = new Set(o.avoid ?? [])
  const out: Record<string, string[]> = {}
  for (const [cat, def] of Object.entries(PROSE_BANK)) {
    const pool = availableWords(cat, o)
    const fresh = pool.filter((w) => !avoid.has(w)), used = pool.filter((w) => avoid.has(w))
    const shuffle = (a: string[]) => a.map((w) => [r(), w] as const).sort((x, y) => x[0] - y[0]).map(([, w]) => w)
    out[cat] = [...shuffle(fresh), ...shuffle(used)].slice(0, def.pick)
  }
  return out
}

/** 从一段回复里找出用到的词库词（去掉数据块；单字的修饰前缀与动作不计） */
export function bankWordsUsed(text: string): string[] {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '')
  const all = new Set<string>()
  for (const [cat, def] of Object.entries(PROSE_BANK)) {
    if (cat === 'mod') continue
    for (const { w } of def.words) {
      const core = w.replace(/[「」]/g, '').replace(/……|——/g, '')
      if (core.length >= 2 && clean.includes(core)) all.add(w)
    }
  }
  return [...all]
}

export const DENSE_MIN_WORDS = 12
export const DENSE_LENGTH = { min: 800, max: 1200 }
/** 聊天流式回复的前端超时：要容得下重油长回复（实测 ~25 字/秒，2700+ 字约 110 秒）+ STATS 块 */
export const STREAM_TIMEOUT_MS = 180_000

/** 【★重油文风★】段：放在系统提示词最末尾，作为最后、最高优先级的文风指令 */
export function denseStyleBlock(o: BankOpts): string {
  const s = sampleBank(o)
  const rows = Object.entries(s).map(([cat, ws]) => `- ${PROSE_BANK[cat].label}：${ws.join('、')}`)
  const recent = (o.avoid ?? []).slice(-10)
  if (recent.length) rows.push(`- 前几段已经用过（这段换别的说法）：${recent.join('、')}`)
  const step = ['迎客', '挑逗', '前戏', '正戏', '清洗'][Math.max(0, Math.min(4, o.stepIndex))]
  const gate = o.climaxAllowed
    ? '本回合有人到了高潮档：高潮类的词（白浊 / 潮水…）可以用，写在已经高潮的那个人身上'
    : `本回合没有人到高潮：不写射精、白浊、喷发、潮吹、绝顶——浓度加在「${step}」这一步此刻的动作上，不往后推进剧情`
  return `【★重油文风（最后的文风指令：只压过前面「简洁/克制」的文风倾向；不压过这一步的强度上限、高潮闸门和字数上限）★】
重油 = 同样的剧情进度，写得更浓更密；不是写得更长，也不是推进得更快。
- ${gate}
- 「${step}」这一步没给的部位与动作不要提前写（前戏不插入，迎客/挑逗不碰性器）
密度要求（每一段都要达到，不是只在开头点一下）：
1. 每一句至少调动两类感官（触感 / 温度 / 气味 / 声音任选两类），整段至少两处气味描写
2. 每个出场的身体部位前叠 3–4 个修饰，用「修饰前缀 + 触感词 + 温度/状态」组合，如「肥软雪腻、沉甸甸发烫的奶球」「湿濡滚烫的穴口」
3. 每段至少一个拟声词，台词里也要夹拟声与喘息
4. 本回合至少用上下面【本回合词库】里 ${DENSE_MIN_WORDS} 个不同的词，同一个词全段只用一次；词库已按当前步骤和档位筛过——这一步没给的词就不要用
5. 动作用具体的动词写到身体上（谁的哪里、被怎样、发出什么声音、留下什么痕迹），少用抽象的「快感」「舒服」
6. 每 100 字至少 4 个感官 / 部位 / 拟声词；寒暄、解释、重复的来回对白压到一两句，把篇幅让给感官
7. 正文 ${DENSE_LENGTH.min}–${DENSE_LENGTH.max} 字，最多 ${DENSE_LENGTH.max} 字（超了就删铺垫和重复对白，不删感官词）；堆叠要新鲜具体，仍然遵守【文风禁令】黑名单
【本回合词库（每回合换一批，化用进句子里）】
${rows.join('\n')}
【重油笔触示例（只示范浓度，不要照抄字句）】
「那团肥软雪腻、沉甸甸坠着的奶球一压上来，汗湿的乳肉便糯糯地摊开，滚烫的奶香裹着雌香直往鼻腔里钻；啾——她的软舌嘬住他的耳垂，湿濡的银丝牵了老长，颤巍巍地断在锁骨窝里。」`
}

/** 重油的每回合提醒（接在玩家消息后） */
export const DENSE_TURN_NOTE = `\n（重油：正文 ${DENSE_LENGTH.min}–${DENSE_LENGTH.max} 字、不超过 ${DENSE_LENGTH.max}；每句两类以上感官词、部位前叠 3–4 个修饰、每段一个拟声，用足【本回合词库】里至少 ${DENSE_MIN_WORDS} 个不同的词。浓度加在这一步此刻的动作上，不提前推进、不越过高潮闸门。）`
