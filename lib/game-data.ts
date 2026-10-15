import { MonstGirl } from '@/lib/types'

// ─── 种族列表 ──────────────────────────────────────────────────────────────────

export interface RaceData {
  name: string
  tags: string
  description: string
}

export const RACES: RaceData[] = [
  { name: '猫娘', tags: 'cat ears, cat tail, nekomata, feline features', description: '拥有猫耳和猫尾的灵动少女' },
  { name: '犬娘', tags: 'dog ears, dog tail, canine girl, fluffy ears', description: '忠诚可爱的犬耳少女' },
  { name: '狐娘', tags: 'fox ears, fox tail, kitsune, multiple tails', description: '神秘妖艳的狐妖少女' },
  { name: '兔娘', tags: 'bunny ears, bunny tail, rabbit girl, long ears', description: '活泼可爱的兔耳少女' },
  { name: '史莱姆', tags: 'slime girl, translucent body, gel body, blue slime', description: '半透明凝胶身体的神秘存在' },
  { name: '拉米亚', tags: 'lamia, snake lower body, scales, snake tail, naga', description: '上身人形下身蛇尾的妖艳女性' },
  { name: '哈比', tags: 'harpy, bird wings, feathers, talons, avian girl', description: '拥有鸟翼的自由少女' },
  { name: '蜘蛛娘', tags: 'arachne, spider lower body, spider girl, eight legs', description: '上身人形下身蜘蛛的神秘织者' },
  { name: '龙娘', tags: 'dragon girl, dragon wings, dragon horns, scales, draconic', description: '骄傲强大的龙族少女' },
  { name: '精灵', tags: 'elf, pointed ears, forest elf, elegant, lithe', description: '长耳优雅的森林守护者' },
  { name: '黑暗精灵', tags: 'dark elf, dark skin, white hair, pointed ears, drow', description: '暗肤白发的地下精灵' },
  { name: '吸血鬼', tags: 'vampire, fangs, pale skin, bat wings, gothic', description: '苍白迷人的永生存在' },
  { name: '魔女', tags: 'witch, witch hat, magical girl, spell casting, occult', description: '精通魔法的神秘女巫' },
  { name: '鬼娘', tags: 'oni girl, horns, club, japanese demon, red skin', description: '拥有鬼角的力量型少女' },
  { name: '牛娘', tags: 'holstaur, cow ears, cow horns, cow tail, large breasts', description: '丰满温柔的牧场少女' },
  { name: '狼娘', tags: 'wolf girl, wolf ears, wolf tail, feral, fierce', description: '野性凶猛的狼族少女' },
]

// ─── 玩家特性 ──────────────────────────────────────────────────────────────────

export const PLAYER_TRAITS = [
  '支配狂', '服从者', '调教师', '温柔派',
  '严厉型', '变态绅士', '守护者', '冒险家',
  '商人', '学者',
]

// ─── 玩家癖好 ──────────────────────────────────────────────────────────────────

export const PLAYER_FETISHES = [
  '巨乳', '贫乳', '兽耳', '尾巴',
  '触手', '拘束', '支配', '服从',
  '制服', '和服', '黑丝', '白丝',
  '妹系', '姐系', '傲娇', '天然呆',
]

// ─── 侍奉技能 ──────────────────────────────────────────────────────────────────

export const SERVING_SKILLS = [
  '口技', '手技', '体位变换', '魅惑舞蹈',
  '按摩', '低语诱惑', '多重服侍', '特殊技巧',
]

// ─── 初始魔物娘模板 ────────────────────────────────────────────────────────────

// Preset image URLs (index matches GIRL_TEMPLATES order)
export const GIRL_TEMPLATE_IMAGES: (string | null)[] = [
  '/presets/qianxue.jpg',    // 千雪
  '/presets/narumeiya.jpg',  // 娜露梅亚
  '/presets/lueira.jpg',     // 露埃拉
  '/presets/wenxiang.jpg',   // 文香
  '/presets/zhixi.jpg',      // 志希
]

// 选角卡片上的一句话简介（index 与 GIRL_TEMPLATES 对应；没有时退回种族简介）
export const GIRL_TEMPLATE_TAGLINES: string[] = [
  '温柔得像午后阳光的奶牛大姐姐',   // 千雪
  '爱调侃又宠溺的剑士姐姐大人',     // 娜露梅亚
  '外表圣洁、内心执着的冰龙圣女',   // 露埃拉
  '躲在书页与丝网后的安静书灵',     // 文香
  '随性好奇、爱「采样」的天才调香师', // 志希
]

export const GIRL_TEMPLATES: Omit<MonstGirl, 'id' | 'imageUrl'>[] = [
  {
    name: '千雪',
    race: '牛娘',
    age: '23',
    bodyDesc: '栗棕色长发编成一条垂在肩前的松麻花辫，琥珀色的垂眼总是含着笑；头顶一对小巧的乳白牛角，黑白花纹的牛耳会随心情轻轻抖动，身后拖着一条带毛穗的花斑牛尾。胸前是沉甸甸、软得像刚揉好面团的爆乳，乳尖常把布料洇出两圈奶渍；腰肢却意外纤细，下身是匀称修长的人腿，肌肤白皙细腻，靠近时能闻到温热的奶香',
    bodyTags: 'holstaur, cow girl, monster girl, cow ears, cow print ears, small cow horns, cow tail, brown hair, long hair, single braid, braid over shoulder, amber eyes, gentle eyes, pale skin, huge breasts, lactation, milk stains, bell collar, motherly aura',
    bust: 105,
    waist: 60,
    hip: 94,
    personality: '像午后阳光一样的大姐姐，说话轻柔、做事细心，总把别人的事放在自己前头——替你理好衣领、悄悄在口袋里塞一颗亲手做的糖。她从容地照顾着所有人，却唯独拿「被照顾」没办法：被夸「好妈妈」会羞得低头，被温柔地挤奶时会捂着嘴不敢出声，可那份「想把最好的都给你」的心意，连身体都藏不住',
    personalityTags: 'gentle, motherly, big sister, nurturing, composed, caring, devoted, shy when praised, secretly loves being milked, handicraft lover',
    outfit: '亲手缝制的浅蓝荷叶边围裙 + 黑色牛铃项圈 + 发尾的黑色蝴蝶结（围裙下只有她自己）',
    outfitTags: 'frilled apron, naked apron, light blue apron, cow bell collar, black choker, black hair bow, milk stains, sideboob, handmade',
    otherDesc: '曾是 283 事务所里最温柔的「大姐姐」偶像，喜欢手工、擅长照顾人。一次替后辈收下的古旧丰饶之角，把沉睡的奶牛灵唤进了她的身体——从此乳汁源源不断，她也坦然接受了这份「能喂饱别人的体质」。如今她在娼馆里开了个小小的手工角落，用热牛奶、手织杯垫和自己的胸怀招待每一位疲惫的客人',
    otherTags: 'shiny colors kuwayama chiyuki, horn of plenty curse, cow spirit, handmade goods, nurturing, warm milk, motherly idol',
    sexualDesc: '乳房饱满又极易出奶，只要被认真地、慢慢地从乳根往前揉开，温热的甜奶就会一股股涌出来，把对方的胸口和她自己的围裙一起浸湿。她最喜欢被温柔却不肯停手地挤奶，会扶着对方的后脑贴进乳间，轻声哄着「慢慢喝……千雪都在这里」，花斑牛尾悄悄卷住对方的腰，不让人退开。H 时乳浪摇晃、奶汁四溅成天然的润滑，容易连续喷乳高潮，乳晕胀大、乳尖硬挺，喘息软得像在哼摇篮曲；高潮后仍会红着脸微笑，用沾了奶的指尖喂到对方唇边，再轻轻吻一下额头。弱点：乳根——被同时揉住两侧乳根会瞬间失控喷奶，进入只想「喂饱你」的顺从状态，晃着胸口小声央求「再多喝一点……」；牛尾根被轻轻一拽，就会膝盖发软跪下，露出少有的、少女般的羞耻神情',
    affection: 28,
    obedience: 25,
    lewdness: 45,
    skills: [],
    imageTags: '1girl, solo, holstaur, cow girl, monster girl, cow ears, cow horns, cow tail, kuwayama chiyuki, brown hair, long hair, single braid, amber eyes, gentle smile, blush, pale skin, huge breasts, cleavage, lactation, milk, frilled apron, naked apron, cow bell, barn, warm lighting, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '娜露梅亚',
    race: '牛娘',
    age: '22',
    bodyDesc: '淡粉紫色的长发松松编成侧辫，一缕刘海斜斜遮住左眼，露出的那只紫瞳总带着三分笑意；头顶一对弯而粗壮的深褐牛角，耳侧是白绒绒的牛耳，腰后垂着一条末端带毛穗的长牛尾。肤色白净如瓷，上身是比千雪更挺、更沉的雄伟巨乳，被腰带勒出的腰线却纤细紧实，那是常年握刀练出来的身段；背后斜挎一柄黑柄太刀，腰间还别着一把胁差',
    bodyTags: 'holstaur, cow girl, monster girl, cow ears, large cow horns, cow tail, light purple hair, pink hair, long hair, side braid, hair over one eye, purple eyes, fair skin, gigantic breasts, toned waist, katana, wakizashi, sheathed sword, lactation',
    bust: 108,
    waist: 58,
    hip: 90,
    personality: '游刃有余的「姐姐大人」：说话慢悠悠、尾音上扬，最爱把人揽进怀里揉脑袋，宠起人来毫无底线，嘴上却一刻不停地调侃——「哎呀，脸红了？姐姐还什么都没做呢」。她剑术一流，拔刀时眼神会瞬间冷下来，收刀后又立刻笑眯眯地问你有没有受伤。在她眼里，被她认定的人永远是需要照顾的「弟弟」；一旦对方不肯被宠，她反而会委屈地鼓起脸，那是她唯一不从容的时候',
    personalityTags: 'onee-san, doting, teasing, confident, playful, skilled swordswoman, calm in battle, possessive big sister, smug smile, pouts when refused',
    outfit: '黑底蝶纹的改良剑士和服（前襟松得兜不住胸）+ 腰带勒出的细腰 + 背后太刀与腰间胁差 + 小小的牛铃发饰',
    outfitTags: 'black kimono, butterfly print, swordswoman outfit, loose collar, cleavage, obi, katana on back, wakizashi, cow bell hair ornament, thighhighs',
    otherDesc: '来自遥远空域的剑术流派传人，一手太刀、一手胁差，曾以「溺爱弟弟」和「剑技精妙」同样出名。一次误闯牛灵祭坛后被诅咒成了奶牛娘，胸口从此总是沉甸甸、湿漉漉的——她倒很快想开了：「这样不是更方便照顾你了吗？」如今她在娼馆里自称「大家的姐姐」，剑仍每天擦拭，只是更多时候用来替喝醉的客人削苹果',
    otherTags: 'granblue fantasy narmaya, draph inspired, swordswoman, katana, wakizashi, doting big sister, cow spirit curse',
    sexualDesc: '她从不等人开口——先用指尖勾住对方的下巴，再像收刀入鞘一样利落地把人按进自己的乳沟，压低嗓音命令「乖，含住，喝到姐姐说停为止」。乳汁浓而甜，一被吮吸就会顺着对方嘴角淌下，她便笑着替人舔掉，顺手拍拍头夸「好孩子」。H 时她喜欢掌控节奏：骑在上面慢慢磨、用牛尾缠住对方手腕不许乱动，看对方忍不住时再坏心地加快，一边喘一边逗「这么快就投降了？剑士可不能这么没耐力哦」。高潮时会弓起腰、咬着下唇发出低低的鸣声，乳尖喷着奶却仍不肯松开怀里的人。弱点：被抢走主导权——被反压在身下、手腕被扣住时，她会瞬间慌了阵脚，红着脸小声说「等、等一下，姐姐还没准备好……」；被叫「姐姐」时同时揉弄乳根，更会让她软成一滩，抱着对方撒娇讨饶',
    affection: 22,
    obedience: 20,
    lewdness: 40,
    skills: [],
    imageTags: '1girl, solo, holstaur, cow girl, monster girl, cow ears, cow horns, cow tail, narmaya (granblue fantasy), light purple hair, long hair, side braid, hair over one eye, purple eyes, fair skin, smug, teasing smile, half-closed eyes, gigantic breasts, cleavage, lactation, black kimono, butterfly print, katana, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '露埃拉',
    race: '龙娘',
    age: '24',
    bodyDesc: '浅冰蓝的长卷发柔柔散开，发间别着几朵淡黄小花，一对蓝色螺旋龙角从鬓边弯出；尖尖的精灵耳，紫水晶般的眼睛总像刚睡醒般迷蒙。肌肤白得近乎透明，指尖和呼吸都带着一丝凉意；胸型丰润挺拔，腰细腿长，身后拖着一条覆着冰晶细鳞的修长龙尾，尾尖会在开心时轻轻敲地',
    bodyTags: 'dragon girl, ice dragon, monster girl, blue dragon horns, curled horns, dragon tail, light blue hair, silver hair, long hair, wavy hair, hair flower, pointy ears, purple eyes, pale skin, large breasts, icy scales, frosty breath',
    bust: 91,
    waist: 57,
    hip: 90,
    personality: '温柔得像初雪的圣女：说话轻声细语，会为客人准备亲手做的冰淇淋，受了委屈也只是安静地笑。可她骨子里流着龙的血——一旦认定「这是我要守护的人」，那份平静就会悄悄结冰：她会一边替你整理衣领，一边不许你多看别人一眼；嘴上说着「我只是在保护你」，尾巴却早已把你圈在了身边',
    personalityTags: 'gentle, saintly, soft-spoken, nurturing, secretly possessive, proud dragon blood, protective, sweets lover, calm smile',
    outfit: '纯白荷叶边抹胸短裙 + 蓝花缎带胸饰 + 金色臂环 + 白色过膝袜（裙摆总沾着一点冰淇淋）',
    outfitTags: 'white frilled dress, strapless, blue flower brooch, gold armlet, wrist cuffs, white thighhighs, lace trim, cleavage',
    otherDesc: '曾为布里塔尼亚献出一切的圣女，在牺牲的尽头觉醒了沉睡的冰龙之血，以龙娘之身归来。她仍保留着做甜点的爱好，常在大厅角落用吐息给大家冻冰淇淋；只是她看人的眼神多了一点龙的执着——被她守护过一次的人，就再也逃不出那片温柔的寒气',
    otherTags: 'lost sword lueira, awakened saintess, ice dragon blood, frost breath, dessert maker, britannia saintess',
    sexualDesc: '她的触碰总是先冷后热：指尖凉得让人一颤，掌心却随着情动慢慢发烫，冷热交替逼得对方起一身鸡皮疙瘩。她喜欢用冰鳞龙尾一圈圈缠住伴侣的腰与大腿，把人固定在自己怀里，贴在耳边低语「让我……完全守护你吧」，再一点点把凉丝丝的吐息吹进对方领口。H 时身体会泛起一层薄霜般的微光，高潮来得又深又长，龙尾会不自觉收紧，像怕怀里的人消失。事后她会抱着对方不肯放，尾尖轻轻蹭着耳后，像守着失而复得的珍宝。弱点：龙角根——被温热的唇吻上角根会让她瞬间融化，眼神失焦、主动吐出带甜味的冰雾，乞求「请……占有我的全部力量」；被温暖的双手捧住胸口揉弄，则会让她卸下圣女的矜持，软软地跪下',
    affection: 26,
    obedience: 28,
    lewdness: 38,
    skills: [],
    imageTags: '1girl, solo, dragon girl, ice dragon, monster girl, blue dragon horns, dragon tail, light blue hair, long hair, hair flower, pointy ears, purple eyes, pale skin, sleepy eyes, calm, light blush, large breasts, cleavage, white frilled dress, white thighhighs, holding spoon, ice cream, parfait, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '文香',
    race: '蜘蛛娘',
    age: '23',
    bodyDesc: '乌黑的长发垂到腰际，额前戴着一条米白发带，刘海下藏着一双湛蓝的大眼睛，鼻梁上架着细框圆眼镜；肤色白皙，上身是被衬衫绷紧的丰满胸脯。腰以下是覆着细密黑绒的蜘蛛躯体，八条漆黑光亮的长腿安静地收在身侧，腹部末端的丝腺口在情动时会渗出微亮的细丝',
    bodyTags: 'arachne, drider, spider girl, monster girl, spider lower body, eight legs, black hair, long hair, hairband, bangs, blue eyes, round glasses, pale skin, huge breasts, cleavage',
    bust: 95,
    waist: 58,
    hip: 88,
    personality: '安静得像图书馆的午后：说话声音轻得像翻书页，常常一句话说到一半就红着脸躲回书后。她读过很多书，其中不少是不能告诉别人的那种——所以她比谁都清楚自己渴望什么，只是不敢说。被人念出她藏在书页间的那句台词时，她会抱紧书本、整个人缩进丝网里，却始终没有真的逃开',
    personalityTags: 'shy, introverted, bookworm, soft-spoken, quiet, easily flustered, secretly desires bondage and submission, well-read',
    outfit: '白色长袖衬衫（胸前纽扣快要绷开）+ 酒红色束腰马甲 + 黑色缎带领结 + 米白发带，书总是不离手',
    outfitTags: 'white shirt, long sleeves, red corset vest, underbust, black ribbon, neck ribbon, hairband, holding book, frills',
    otherDesc: '在禁书库里守了不知多少年的书灵，某天翻开一本写满织网咒文的古籍，下半身便化作了安静的黑色蛛躯。她仍习惯躲在书架的阴影里，用细丝给书页做书签、把喜欢的句子一根根缠在网上；被带到娼馆后，她最先问的是「这里……有书房吗」',
    otherTags: 'sagisawa fumika inspired, library spirit, forbidden book, weaving spell, bookworm, ancient library',
    sexualDesc: '蛛丝是她最诚实的语言：害羞到说不出口时，她会先用丝把自己的手腕悄悄缠住，再红着脸把线头递到对方手里。她喜欢被一点点吊进自己织的网里，丝线同时勒过乳尖、颈侧和大腿内侧，动弹不得时反而会长长地松一口气，眼镜被呼吸蒙上白雾。H 时八条蛛腿会下意识地轻轻收拢，把对方圈在身下，像在保护，又像在占有；在蛛网吊床上被从下方进入时最容易连续高潮，甚至会轻微失禁，事后羞得用丝把两人一起裹进茧里不肯出来。弱点：丝腺口与蛛腿根部——被触碰时会瞬间软掉，细声求饶说出平时绝不敢说的请求；眼镜是她的开关，被摘下的那一刻，安静的书灵会变得意外主动而贪婪',
    affection: 18,
    obedience: 12,
    lewdness: 25,
    skills: [],
    imageTags: '1girl, solo, arachne, drider, spider girl, monster girl, spider lower body, spider legs, black hair, long hair, hairband, glasses, round glasses, blue eyes, pale skin, shy, blush, flustered, huge breasts, cleavage, white shirt, red corset, holding book, spider web, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '志希',
    race: '拉米亚',
    age: '18',
    bodyDesc: '一头蓬松凌乱的酒红色长卷发，呆毛永远翘着；天蓝色的眼睛总在打量什么，嘴角是猫一样的小尖牙笑。上身纤细、胸形小巧挺翘，腰下连着一条粗长的绯红蛇尾，鳞片光滑得能映出灯影，腹侧是颜色更浅的软鳞；她总把尾巴卷成一团当靠垫',
    bodyTags: 'lamia, snake girl, monster girl, snake tail, red scales, long tail, wine red hair, long hair, wavy hair, messy hair, ahoge, blue eyes, cat mouth, fang, pale skin, medium breasts',
    bust: 86,
    waist: 57,
    hip: 85,
    personality: '天才调香师兼惯犯失踪者：前一秒还在烧杯前哼着歌，下一秒已经贴到你颈侧深吸一口气——「嗯～这个味道，记录一下」。对无聊过敏，对新奇来者不拒，做事全凭兴致，常把实验室炸得满屋香雾。她看似什么都不在乎，其实只是还没找到「闻不腻」的人；一旦找到，就会像蛇一样缠上来，不讲道理',
    personalityTags: 'genius chemist, curious, free-spirited, whimsical, scent obsessed, playful, unpredictable, mischievous, cat-like',
    outfit: '宽大的白大褂（底下只有一套黑色亮面比基尼）+ 挂在领口的自制香水小瓶 + 随手别在发间的试管',
    outfitTags: 'oversized lab coat, open coat, black bikini, shiny bikini, perfume bottle necklace, test tube hair ornament',
    otherDesc: '化学系出身的天才少女，痴迷香水与各种奇怪的实验。在一次调配「能让人永远记住的香味」时打翻了古老的蛇灵精油，醒来下半身已变成了绯红的蛇尾。她对此毫不在意，反而很满意新得到的嗅觉：现在她能隔着三条走廊闻出谁今天心情好——然后溜过去「采样」',
    otherTags: 'ichinose shiki inspired, perfumer, mad scientist, snake spirit oil, scent obsession, laboratory',
    sexualDesc: '她用鼻子和舌头认识一个人：先凑近颈侧、锁骨和耳后一寸寸地嗅，再用细长的舌尖像蛇信一样轻点皮肤「采样」，满意时会发出猫一样的咕噜声。她喜欢把自调的香水抹在对方锁骨上，再用绯红蛇尾从脚踝一圈圈缠上来，把人卷成一只暖烘烘的茧，只留下脸让她慢慢研究。H 时她兴奋得快、潮吹也快，尾尖会不受控制地拍打床单，一边喘一边还在嘀咕「记录……反应强度……再来一次」。弱点：尾根与腹侧软鳞的交界处——被指尖轻轻挠过就会瞬间软成一滩，尾巴松开、强制高潮，难得地说不出完整的话',
    affection: 25,
    obedience: 18,
    lewdness: 35,
    skills: [],
    imageTags: '1girl, solo, lamia, snake girl, monster girl, snake tail, red scales, wine red hair, long hair, wavy hair, ahoge, blue eyes, cat mouth, fang, tongue out, mischievous smile, pale skin, medium breasts, oversized lab coat, black bikini, perfume bottle, laboratory, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
]

export const GUEST_RACES = [
  '人类冒险家', '矮人战士', '兽人武者', '精灵游侠',
  '黑暗精灵盗贼', '人类商人', '魔法学徒', '退役骑士',
  '半兽人雇佣兵', '吸血贵族', '侏儒机械师', '海妖船长',
]

// ─── 客人性格 ──────────────────────────────────────────────────────────────────

export const GUEST_PERSONALITIES = [
  '粗犷豪爽', '温文尔雅', '腼腆内向', '傲慢自大',
  '神秘低调', '豪迈豁达', '敏感细腻', '老实憨厚',
]

// ─── 客人特性 ──────────────────────────────────────────────────────────────────

export const GUEST_TRAITS = [
  '财大气粗', '小气吝啬', '体力过人', '技巧熟练',
  '初次体验', '老顾客', '特殊癖好', '花心',
  '专一', '沉默寡言', '话痨',
]
