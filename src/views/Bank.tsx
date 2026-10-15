import { useState, type CSSProperties } from 'react'
import { bank, bankCats, candidates } from '../data'
import { addBankCat, addBankItem, addQuestion, commit, findC, slotLabel, useStore } from '../store'
import { Btn, Chip, Empty, Field, Modal } from './ui'

const DIFFS = ['基础', '中等', '较难']

const DRAFT_KEY = 'facetry-bank-draft'
const HIDDEN_KEY = 'facetry-bank-hidden'

type Draft = { cat: string; tag: string; diff: string; q: string; points: string; answer: string; follow: string; flag: string }
type BankItem = (typeof bank)[number]

const loadStash = (): Draft | null => {
  try {
    const s = localStorage.getItem(DRAFT_KEY)
    return s ? (JSON.parse(s) as Draft) : null
  } catch {
    return null
  }
}

/** 隐藏状态：题库数据在 data.ts 的 bank 里，隐藏只做前端可恢复的标记并落 localStorage */
const loadHidden = (): string[] => {
  try {
    const s = localStorage.getItem(HIDDEN_KEY)
    const v = s ? (JSON.parse(s) as unknown) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const LINES = (v: string) =>
  v
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

const VIEWS = [
  { key: 'all', label: '全部' },
  { key: 'shown', label: '仅显示' },
  { key: 'hidden', label: '仅隐藏' },
] as const

type ViewKey = (typeof VIEWS)[number]['key']

export default function Bank() {
  useStore()
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const [view, setView] = useState<ViewKey>('all')
  const [open, setOpen] = useState<string>() // 展开答案的题目 id
  const [hidden, setHidden] = useState<string[]>(loadHidden)
  const [toast, setToast] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [entering, setEntering] = useState(false)
  // 分类兜底：bankCats 为空（例如数据被重置）时退回题库里实际存在的分类，不依赖 bankCats[0]
  const cats = bankCats.length ? bankCats : Array.from(new Set(bank.map((b) => b.cat)))
  const firstCat = cats[0] ?? bank[0]?.cat ?? '未分类'
  const [draft, setDraft] = useState<Draft>({ cat: firstCat, tag: '基础', diff: '中等', q: '', points: '', answer: '', follow: '', flag: '' })
  const [stash, setStash] = useState<Draft | null>(loadStash) // 暂存：只保留最近一道题

  // 编辑弹窗
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft | null>(null)
  const [editErr, setEditErr] = useState('')
  // 加入本场题目弹窗
  const [pickFor, setPickFor] = useState<BankItem | null>(null)

  const targets = candidates.filter((c) => c.status === '约面中')
  const say = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2400)
  }
  const persistHidden = (ids: string[]) => {
    setHidden(ids)
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids))
    } catch {
      /* 存储不可用时仅保留内存态，不阻断操作 */
    }
  }
  const add = (cid: string, b: BankItem) => {
    addQuestion(cid, {
      q: b.q,
      topic: b.cat === '综合' ? '行为面试' : '技术深挖',
      diff: b.diff,
      basis: `题库 · ${b.cat}`,
      points: b.points,
      answer: b.answer,
      follow: b.follow,
      flag: b.flag,
    })
    setPickFor(null)
    const c = findC(cid)
    say(c ? `已加入 ${c.name} 的本场题目` : '该候选人已不在列表中，未加入题目')
  }
  const toggleHidden = (b: BankItem) => {
    const isHidden = hidden.includes(b.id)
    persistHidden(isHidden ? hidden.filter((id) => id !== b.id) : [...hidden, b.id])
    say(isHidden ? '已恢复：该题目重新出现在选题与出题列表' : '已隐藏：该题目不再出现在选题与出题列表，可随时恢复')
  }
  const shownIn = (list: BankItem[]) => list.filter((b) => (view === 'hidden' ? hidden.includes(b.id) : view === 'shown' ? !hidden.includes(b.id) : true))
  const byCatAndSearch = bank.filter((b) => (cat === '全部' || b.cat === cat) && (!q || b.q.includes(q) || b.answer.includes(q)))
  const list = shownIn(byCatAndSearch)
  const hiddenCount = bank.filter((b) => hidden.includes(b.id)).length

  const submitCat = () => {
    addBankCat(newCat)
    if (newCat.trim()) setCat(newCat.trim())
    setNewCat('')
    setAddingCat(false)
  }
  const hasContent = !!(draft.q.trim() || draft.answer.trim() || draft.points.trim() || draft.follow.trim() || draft.flag.trim())
  const clearStash = () => {
    localStorage.removeItem(DRAFT_KEY)
    setStash(null)
  }
  const stashIt = () => {
    if (!hasContent) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    setStash(draft)
    say('已暂存，下次打开可继续填写')
  }
  const restoreStash = () => {
    if (!stash) return
    setDraft({ ...stash })
    clearStash()
    say('已载入暂存内容')
  }
  const submitItem = () => {
    if (!draft.q.trim() || !draft.answer.trim()) return say('题目与参考答案是必填项')
    addBankItem({
      cat: draft.cat,
      q: draft.q.trim(),
      tag: draft.tag,
      diff: draft.diff,
      points: LINES(draft.points),
      answer: draft.answer.trim(),
      follow: LINES(draft.follow),
      flag: draft.flag.trim(),
    })
    setDraft({ ...draft, q: '', points: '', answer: '', follow: '', flag: '' })
    clearStash()
    setEntering(false)
    setCat(draft.cat)
    setView('shown')
    say('已录入题库')
  }

  const startEdit = (b: BankItem) => {
    setEditErr('')
    setEditId(b.id)
    setEditDraft({ cat: b.cat, tag: b.tag, diff: b.diff, q: b.q, points: b.points.join('\n'), answer: b.answer, follow: b.follow.join('\n'), flag: b.flag })
  }
  const saveEdit = () => {
    if (!editId || !editDraft) return
    if (!editDraft.q.trim() || !editDraft.answer.trim()) {
      setEditErr('题目与参考答案是必填项')
      return
    }
    const target = bank.find((b) => b.id === editId)
    if (!target) {
      setEditErr('该题目已不存在（可能已被重置数据），请关闭后重新选择')
      return
    }
    target.cat = editDraft.cat
    target.tag = editDraft.tag
    target.diff = editDraft.diff
    target.q = editDraft.q.trim()
    target.points = LINES(editDraft.points)
    target.answer = editDraft.answer.trim()
    target.follow = LINES(editDraft.follow)
    target.flag = editDraft.flag.trim()
    commit() // 写回题库并持久化，刷新后仍是编辑后的内容
    setEditId(null)
    setEditDraft(null)
    setCat(editDraft.cat)
    say('已保存题目修改')
  }

  const editCatOptions = Array.from(new Set([...(editDraft ? [editDraft.cat] : []), ...cats]))

  return (
    <div className="space-y-7">
      <div className="ws-rise flex flex-col justify-between gap-5 border-b border-base-300 pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-base-content">团队能力标尺题库</h1>
            <Chip tone="ghost">已沉淀 {bank.length} 道标准试题</Chip>
            {hiddenCount > 0 && (
              <Chip tone="neutral" className="bg-neutral text-neutral-content">
                {hiddenCount} 道已隐藏
              </Chip>
            )}
          </div>
          <p className="mt-1.5 text-xs text-base-content/60">
            沉淀各专业序列的标准考察问题、考核维度、参考答案与减分负向信号；题目可编辑、可隐藏并在需要时恢复
          </p>
        </div>
        <Btn variant={entering ? 'outline' : 'solid'} onClick={() => setEntering(!entering)}>
          {entering ? '收起录入' : '录入新题'}
        </Btn>
      </div>

      {entering && (
        <div className="login-fade card card-border bg-base-100 shadow-[var(--shadow-paper)]">
          <div className="card-body gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-base-content">录入一道题</h2>
              <span className="text-xs text-base-content/50">暂存只保留最近一道题，再次暂存会覆盖</span>
            </div>
            {stash && (
              <div className="alert alert-soft alert-warning items-center">
                <span className="min-w-0 flex-1 truncate text-sm">
                  有 1 条暂存的题目{stash.q.trim() ? `：${stash.q.trim().slice(0, 30)}${stash.q.trim().length > 30 ? '…' : ''}` : ''}
                </span>
                <Btn variant="ghost" onClick={restoreStash}>
                  继续填写
                </Btn>
                <Btn variant="ghost" onClick={clearStash}>
                  丢弃
                </Btn>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="分类" htmlFor="new-cat">
                <select id="new-cat" className="select w-full" value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })}>
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="难度" htmlFor="new-diff">
                <select id="new-diff" className="select w-full" value={draft.diff} onChange={(e) => setDraft({ ...draft, diff: e.target.value })}>
                  {DIFFS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="标签" htmlFor="new-tag" hint="如：基础 / 设计 / 案例">
                <input id="new-tag" className="input w-full" value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} />
              </Field>
            </div>
            <Field label="题目" htmlFor="new-q" required>
              <textarea
                id="new-q"
                autoFocus
                rows={2}
                className="textarea w-full resize-none text-[15px]"
                placeholder="题目（必填）"
                value={draft.q}
                onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="考察要点" htmlFor="new-points" hint="选填，每行一条">
                <textarea
                  id="new-points"
                  rows={3}
                  className="textarea w-full resize-none"
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: e.target.value })}
                />
              </Field>
              <Field label="追问" htmlFor="new-follow" hint="选填，每行一条">
                <textarea
                  id="new-follow"
                  rows={3}
                  className="textarea w-full resize-none"
                  value={draft.follow}
                  onChange={(e) => setDraft({ ...draft, follow: e.target.value })}
                />
              </Field>
            </div>
            <Field label="参考答案 / 期望回答" htmlFor="new-answer" required>
              <textarea
                id="new-answer"
                rows={3}
                className="textarea w-full resize-none"
                value={draft.answer}
                onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              />
            </Field>
            <Field label="减分信号" htmlFor="new-flag" hint="选填：什么样的回答要警惕">
              <input id="new-flag" className="input w-full" value={draft.flag} onChange={(e) => setDraft({ ...draft, flag: e.target.value })} />
            </Field>
            <div className="flex items-center justify-end gap-3">
              <Btn variant="ghost" disabled={!hasContent} onClick={stashIt}>
                暂存
              </Btn>
              <Btn variant="solid" onClick={submitItem}>
                存入题库
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        {/* 分类：按岗位组织，可自定义（一位面试官常面多个岗位） */}
        <aside className="w-full shrink-0 md:w-40">
          <ul className="ws-rise [--i:1] ws-paper rounded-xl py-1.5 text-sm">
            {['全部', ...cats].map((c) => {
              const on = cat === c
              const n = c === '全部' ? shownIn(bank).length : shownIn(bank).filter((b) => b.cat === c).length
              return (
                <li key={c}>
                  {/* 荧光青柠落点：当前分类 → 实底荧光小块；hover 底色只给未选中项 */}
                  <button
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => setCat(c)}
                    className={`motion-pop flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2 text-left ${
                      on
                        ? 'bg-accent font-medium text-accent-content'
                        : 'text-base-content/60 hover:bg-base-200/60 hover:text-base-content'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-accent-content" aria-hidden="true" />}
                      {c}
                    </span>
                    <span className={`tabular-nums text-xs ${on ? 'text-accent-content/70' : 'text-base-content/50'}`}>{n}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {addingCat ? (
            <div className="login-fade mt-2 card card-border bg-base-100 p-2 shadow-[var(--shadow-paper)]">
              <Field label="新分类名称" htmlFor="new-cat-name">
                <input
                  id="new-cat-name"
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitCat()}
                  placeholder="如：测试"
                  className="input input-sm w-full"
                />
              </Field>
              <div className="mt-1.5 flex justify-end gap-3">
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setAddingCat(false)
                    setNewCat('')
                  }}
                >
                  取消
                </Btn>
                <Btn variant="outline" onClick={submitCat}>
                  添加
                </Btn>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCat(true)}
              className="motion-pop mt-2 w-full cursor-pointer rounded-xl border border-dashed border-base-300 py-2 text-sm text-base-content/60 hover:border-base-content/30 hover:bg-base-100 hover:text-base-content"
            >
              新建分类
            </button>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="ws-rise [--i:1] flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索题目或答案…"
              aria-label="搜索题目或答案"
              className="input h-9 w-full sm:w-72"
            />
            <div className="tabs tabs-box" role="group" aria-label="显示范围筛选">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={view === v.key}
                  onClick={() => setView(v.key)}
                  className={`tab ${view === v.key ? 'tab-active' : ''}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <ol className="stagger mt-3 space-y-4">
            {list.map((b, i) => {
              const expanded = open === b.id
              const isHidden = hidden.includes(b.id)
              const answerId = `bank-answer-${b.id}`
              return (
                <li
                  key={b.id}
                  style={{ '--i': Math.min(i, 7) } as CSSProperties}
                  className="motion-pop card card-border bg-base-100 shadow-[var(--shadow-paper)] hover:border-base-content/20"
                >
                  <div className="card-body gap-4 p-5">
                    <div className="flex items-start justify-between gap-5">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? undefined : b.id)}
                        aria-expanded={expanded}
                        aria-controls={answerId}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <div className={`text-[15px] font-medium ${isHidden ? 'text-base-content/50' : 'text-base-content'}`}>{b.q}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-base-content/50">
                          <span>
                            {b.cat} · {b.tag} · {b.diff} · {b.hot} 次团队使用
                          </span>
                          {isHidden && (
                            <Chip tone="neutral" className="bg-neutral text-neutral-content">
                              已隐藏
                            </Chip>
                          )}
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? undefined : b.id)}
                          aria-expanded={expanded}
                          aria-controls={answerId}
                          className="motion-pop cursor-pointer text-sm text-base-content/60 hover:text-base-content"
                        >
                          {expanded ? '收起' : '答案'}
                        </button>
                        <Btn variant="outline" onClick={() => startEdit(b)} ariaLabel={`编辑题目：${b.q}`}>
                          编辑
                        </Btn>
                        <Btn
                          variant={isHidden ? 'soft' : 'ghost'}
                          onClick={() => toggleHidden(b)}
                          ariaLabel={isHidden ? `恢复题目：${b.q}` : `隐藏题目：${b.q}`}
                        >
                          {isHidden ? '恢复' : '隐藏'}
                        </Btn>
                        {!isHidden && (
                          <Btn variant="outline" onClick={() => setPickFor(b)} ariaLabel={`把题目加入候选人的本场题目：${b.q}`}>
                            加入本场题目
                          </Btn>
                        )}
                      </div>
                    </div>
                    {expanded && (
                      <div id={answerId} className="login-fade space-y-4 border-t border-base-300 pt-4 text-sm leading-6">
                        {!!b.points.length && (
                          <div>
                            <div className="text-xs font-medium text-base-content/60">考察要点</div>
                            <ul className="mt-1 space-y-1.5 text-base-content/80">
                              {b.points.map((p) => (
                                <li key={p}>· {p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium text-base-content/60">参考答案</div>
                          <p className="mt-1 text-base-content/80">{b.answer}</p>
                        </div>
                        {!!b.follow.length && (
                          <div>
                            <div className="text-xs font-medium text-base-content/60">追问</div>
                            <ul className="mt-1 space-y-1.5 text-base-content/80">
                              {b.follow.map((f) => (
                                <li key={f}>· {f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {b.flag && (
                          <p className="alert alert-soft alert-warning">
                            <span>
                              <b className="font-medium">减分信号</b>　{b.flag}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
            {!list.length && (
              <li className="card card-border bg-base-100 shadow-[var(--shadow-paper)]">
                <div className="card-body">
                  <Empty
                    title={view === 'hidden' ? '还没有隐藏的题目' : q ? '没有匹配的题目' : `${cat === '全部' ? '题库' : cat}下还没有题目`}
                    hint={
                      view === 'hidden'
                        ? '被隐藏的题目会出现在这里，可随时恢复。'
                        : q
                          ? '换个关键词试试，或清空搜索查看全部题目。'
                          : '录入后可被面试官在出题与选题时直接引用。'
                    }
                    action={
                      view !== 'hidden' && !q ? (
                        <Btn variant="solid" onClick={() => setEntering(true)}>
                          录入新题
                        </Btn>
                      ) : undefined
                    }
                  />
                </div>
              </li>
            )}
          </ol>
        </div>
      </div>

      {/* 加入本场题目：浮层统一走 Modal（Esc / 遮罩可关） */}
      <Modal
        open={!!pickFor}
        onClose={() => setPickFor(null)}
        title="加入本场题目"
        sub={pickFor ? pickFor.q : undefined}
        footer={
          <Btn variant="ghost" onClick={() => setPickFor(null)}>
            关闭
          </Btn>
        }
      >
        {targets.length ? (
          <div className="stagger space-y-3">
            <p className="text-xs text-base-content/60">选择候选人（当前处于「约面中」的场次）</p>
            {targets.map((c, i) => {
              const has = pickFor ? c.qs.some((x) => x.q === pickFor.q) : false
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={has}
                  onClick={() => pickFor && add(c.id, pickFor)}
                  style={{ '--i': Math.min(i, 7) } as CSSProperties}
                  className="motion-pop flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border border-base-300 px-3 py-2 text-left text-sm hover:bg-base-200 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-base-100"
                >
                  <span className="text-base-content">
                    {c.name}
                    <span className="ml-2 text-xs text-base-content/50">{slotLabel(c.slot)}</span>
                  </span>
                  {has ? <Chip tone="ghost">已添加</Chip> : <span className="text-xs text-base-content/50">加入</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <Empty title="暂无约面中的候选人" hint="先在工作台完成约面，题目才能挂到具体场次上。" />
        )}
      </Modal>

      {/* 编辑题目 */}
      <Modal
        open={!!editId}
        onClose={() => {
          setEditId(null)
          setEditDraft(null)
          setEditErr('')
        }}
        title="编辑题目"
        sub="保存后立即写回题库并持久化，刷新后仍为编辑后的内容"
        footer={
          <>
            <Btn
              variant="ghost"
              onClick={() => {
                setEditId(null)
                setEditDraft(null)
                setEditErr('')
              }}
            >
              取消
            </Btn>
            <Btn variant="solid" onClick={saveEdit}>
              保存修改
            </Btn>
          </>
        }
      >
        {editDraft && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="分类" htmlFor="edit-cat">
                <select id="edit-cat" className="select w-full" value={editDraft.cat} onChange={(e) => setEditDraft({ ...editDraft, cat: e.target.value })}>
                  {editCatOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="难度" htmlFor="edit-diff">
                <select id="edit-diff" className="select w-full" value={editDraft.diff} onChange={(e) => setEditDraft({ ...editDraft, diff: e.target.value })}>
                  {DIFFS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="标签" htmlFor="edit-tag">
                <input id="edit-tag" className="input w-full" value={editDraft.tag} onChange={(e) => setEditDraft({ ...editDraft, tag: e.target.value })} />
              </Field>
            </div>
            <Field label="题目" htmlFor="edit-q" required>
              <textarea id="edit-q" rows={2} className="textarea w-full resize-none text-[15px]" value={editDraft.q} onChange={(e) => setEditDraft({ ...editDraft, q: e.target.value })} />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="考察要点" htmlFor="edit-points" hint="每行一条">
                <textarea id="edit-points" rows={4} className="textarea w-full resize-none" value={editDraft.points} onChange={(e) => setEditDraft({ ...editDraft, points: e.target.value })} />
              </Field>
              <Field label="追问" htmlFor="edit-follow" hint="每行一条">
                <textarea id="edit-follow" rows={4} className="textarea w-full resize-none" value={editDraft.follow} onChange={(e) => setEditDraft({ ...editDraft, follow: e.target.value })} />
              </Field>
            </div>
            <Field label="参考答案 / 期望回答" htmlFor="edit-answer" required>
              <textarea id="edit-answer" rows={4} className="textarea w-full resize-none" value={editDraft.answer} onChange={(e) => setEditDraft({ ...editDraft, answer: e.target.value })} />
            </Field>
            <Field label="减分信号" htmlFor="edit-flag" hint="什么样的回答要警惕">
              <input id="edit-flag" className="input w-full" value={editDraft.flag} onChange={(e) => setEditDraft({ ...editDraft, flag: e.target.value })} />
            </Field>
            {editErr && <p className="text-[11px] text-error">{editErr}</p>}
          </div>
        )}
      </Modal>

      {toast && (
        <div className="toast toast-end z-30">
          <div className="alert alert-soft alert-success">
            <span className="text-xs">{toast}</span>
          </div>
        </div>
      )}
    </div>
  )
}
