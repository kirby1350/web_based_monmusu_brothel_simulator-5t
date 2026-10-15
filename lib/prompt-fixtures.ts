// 提示词测试 / 样例共用的夹具
import type { Guest, MonstGirl, Player } from './types'
import { migrateGirl } from './migrate-save'

export const fxPlayer: Player = { name: '武藤', traits: ['温柔'], customTraits: '', fetishes: ['黑丝'], gold: 500, day: 6, guestPreference: '', marketPreference: '', trainingRoomLevel: 2, serviceRoomLevel: 2, dormLevel: 2 }

export const fxGirl = (o: Partial<MonstGirl> = {}): MonstGirl => migrateGirl({
  id: 'qx', name: '千雪', race: '狐娘', age: '19', bodyDesc: '银白狐耳与九条蓬松尾巴', bodyTags: 'fox ears, fox tails', bust: 96, waist: 58, hip: 92,
  personality: '傲娇嘴硬，其实很黏人', personalityTags: 'tsundere', outfit: '白色巫女服', outfitTags: 'miko, white kimono, red hakama',
  otherDesc: '', otherTags: '', affection: 45, obedience: 38, lewdness: 52, skills: [],
  imageTags: '1girl, fox girl, fox ears, multiple tails, silver hair, large breasts, miko, white kimono, red hakama, anime, masterpiece, best quality',
  skillRanks: { 待客: '熟练', 口侍: '初学' }, msProgress: { m: 3, s: 0 }, sensitivities: { 耳朵: 80, 阴蒂: 45, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15, 种族: 55 },
  stamina: 70, ...o,
} as MonstGirl)

export const fxGuest = (o: Partial<Guest> = {}): Guest => ({
  id: 'g1', name: '王老板', race: '人类商人', personality: '温和但挑剔', traits: ['恋足'], desires: '想看她穿着黑丝慢慢伺候',
  satisfaction: 0, budget: 120, visits: 0, prefRace: '狐娘', prefTrait: '巨乳', prefOutfit: '黑丝', ...o,
} as Guest)
