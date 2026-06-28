# BodySync UI リデザイン仕様書 (Gemini実装用)

対象: `mobile/src/screens/HomeScreen.tsx` を中心としたダーク×ネオン基調UIへの刷新。
既存のロジック(React Query / Zustand / モーダル / AI提案フロー)は維持し、見た目とレイアウトのみ刷新する。

---

## 1. デザイントークン

`mobile/src/theme/colors.ts` (新規作成) に以下を定義する。

```ts
export const colors = {
  bg: {
    primary: '#0A0E18',   // 画面全体の背景
    card: '#131C33',      // カード背景
    cardAlt: '#0E1526',   // アバターセクション背景
    navBar: '#0F1422',    // ボトムナビ背景
  },
  neon: {
    blue: '#2FC8FF',
    orange: '#FF8033',
    green: '#4ADE80',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#8A93A6',
    muted: '#5A6478',
  },
  border: {
    blue: 'rgba(47,200,255,0.4)',
    subtle: '#1E2638',
  },
};
```

- フォント: 既存どおりOSデフォルト(`System`)。見出しは `fontWeight: '700'`、本文は `'500'`。
- グロー表現: React Nativeに`box-shadow`の発光はないため、`shadowColor`+`shadowOpacity: 0.6`+`shadowRadius: 8~16`+`elevation`(Android)で近似する。`react-native-svg`が導入済みなので、アイコンはSVGパスで作成する。

---

## 2. 画面全体構造 (HomeScreen)

```
ScrollView (bg: colors.bg.primary)
├─ Header
│   ├─ ProfileAvatar (円形, グラデーション blue→orange)
│   ├─ JourneyText
│   │   ├─ "Your BodySync Journey: Day {streak.currentDays}"
│   │   └─ "Current Goal: {goal.mode に応じた表示}"  (neon.orange)
│   └─ NotificationIcon (ベルSVG, text.secondary)
│
├─ AvatarVisualSection (bg: colors.bg.cardAlt, height: 380)
│   ├─ AvatarSilhouette (人体シルエットSVG, 左右ハーフを neon.blue / neon.orange で分割塗装 + drop shadow glow)
│   │   ※ 既存の `avatarImages[bodyState]` 画像をオーバーレイ表示する場合はSilhouetteの上に半透明で重ねる
│   └─ DataOverlay (floating labels, absolute position)
│       ├─ "{bodyFatPct}% Body Fat"      → 右上, neon.orange枠
│       ├─ "Muscle Mass: {muscleMassKg}kg" → 左中, neon.blue枠
│       └─ "BMI: {bmi}"                  → 下中央, neon.blue枠
│
├─ AIAdvisorCard (bg: colors.bg.card, border: neon.blue, cornerRadius 16)
│   ├─ "✦ Powered by Gemini API"  (neon.blue, fontSize 11)
│   ├─ TabBar
│   │   ├─ Tab "Nutrition" (active: bg濃いblue, border neon.blue)
│   │   └─ Tab "Workout" (inactive: 透明, border muted)
│   ├─ MealPhoto (画像 or グラデーションプレースホルダー, cornerRadius 12)
│   ├─ InfoRow (緑チェックアイコン) — "Meal Analysis: {advice.meal_advice}"
│   └─ InfoRow (電球アイコン, neon系 #FFD166) — "Daily Tip: {advice.exercise_advice}"
│
├─ (既存) ジャーニーチェック・AI提案ボタン・モーダル群
│   → カード/ボタンの配色を colors.bg.card / colors.neon.* に置き換えるのみで構造は維持
│
└─ BottomNav (bg: colors.bg.navBar, 上部border: colors.border.subtle)
    ├─ Home      (active: neon.blue + glow)
    ├─ Journey
    ├─ Workouts
    ├─ Nutrition
    └─ Settings  (各 inactive: text.muted)
```

---

## 3. コンポーネント詳細仕様

### 3.1 Header

```tsx
<View style={styles.header}>
  <View style={styles.headerLeft}>
    <View style={styles.profilePhoto} />  {/* LinearGradient or SVG circle: blue→orange */}
    <View>
      <Text style={styles.journeyTitle}>Your BodySync Journey: Day 45</Text>
      <Text style={styles.journeyGoal}>Current Goal: Performance Focus</Text>
    </View>
  </View>
  <BellIcon />
</View>
```

スタイル値:
- `header`: `flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingTop:24, paddingBottom:16`
- `profilePhoto`: `width:44, height:44, borderRadius:22`, グラデーション `colors.neon.blue → colors.neon.orange` (`react-native-linear-gradient`は未導入のため、`react-native-svg`の`<LinearGradient>`+`<Circle>`で実装するか、単色 `colors.neon.blue` で代替)
- `journeyTitle`: `fontSize:15, fontWeight:'700', color: colors.text.primary`
- `journeyGoal`: `fontSize:12, fontWeight:'600', color: colors.neon.orange, marginTop:2`
- ベルアイコン: `react-native-svg`で24x24、`stroke: colors.text.secondary`

### 3.2 AvatarVisualSection

```tsx
<View style={styles.avatarSection}>
  <AvatarSilhouette style={styles.silhouette} />
  <DataLabel text="38.3% Body Fat" color={colors.neon.orange} style={{ top: 60, right: 20 }} />
  <DataLabel text="Muscle Mass: 42.1kg" color={colors.neon.blue} style={{ top: 140, left: 20 }} />
  <DataLabel text="BMI: 22.4" color={colors.neon.blue} style={{ bottom: 20, alignSelf: 'center' }} />
</View>
```

- `avatarSection`: `height:380, backgroundColor: colors.bg.cardAlt, position:'relative', overflow:'hidden'`
- `AvatarSilhouette`: `react-native-svg`の`<Path>`で頭部(円)+胸郭から腰までの人体シルエットを1パスで描画。`<LinearGradient>` (`x1=0% x2=100%`) で `colors.neon.blue` (0%〜49.9%) → `colors.neon.orange` (50.1%〜100%) のハードストップを設定し、`fill="url(#bodyGradient)"`。`<Path>`に`shadowColor`相当はSVG非対応のため、外側に`View`を置き`shadowColor: colors.neon.blue, shadowOpacity:0.5, shadowRadius:40`を付与してグロー風にする。
- `DataLabel`: `position:'absolute'`, `flexDirection:'row', paddingVertical:6, paddingHorizontal:12, borderRadius:8, backgroundColor:'rgba(15,20,35,0.9)', borderWidth:1, borderColor: color, shadowColor: color, shadowOpacity:0.6, shadowRadius:12`。テキストは `fontSize:12, fontWeight:'700', color`。

実データ連携: `bodyFatPct` / `muscleMassKg` / `bmi` はプロフィールAPI (`/users/me`) のレスポンスに項目が無い場合、バックエンド拡張が必要(別途検討)。当面は固定値またはプロフィール値から算出可能なBMIのみ表示。

### 3.3 AIAdvisorCard

```tsx
<View style={styles.advisorCard}>
  <Text style={styles.geminiLabel}>✦ Powered by Gemini API</Text>
  <View style={styles.tabRow}>
    <Tab label="Nutrition" active={activeTab === 'nutrition'} onPress={...} />
    <Tab label="Workout" active={activeTab === 'workout'} onPress={...} />
  </View>
  {activeTab === 'nutrition' && (
    <>
      <View style={styles.mealPhoto} />{/* or <Image> if available */}
      <Text style={styles.mealPhotoLabel}>Breakfast — Fruit & Nuts Bowl</Text>
      <InfoRow icon={<CheckCircleIcon color={colors.neon.green} />}>
        Meal Analysis: {advice?.meal_advice}
      </InfoRow>
      <InfoRow icon={<BulbIcon color="#FFD166" />}>
        Daily Tip: {advice?.exercise_advice}
      </InfoRow>
    </>
  )}
  {activeTab === 'workout' && (/* 既存の運動提案ボタン・モーダル起動に接続 */)}
</View>
```

スタイル値:
- `advisorCard`: `marginHorizontal:20, marginTop:8, marginBottom:24, padding:16, borderRadius:16, backgroundColor: colors.bg.card, borderWidth:1, borderColor: colors.neon.blue`
- `geminiLabel`: `fontSize:11, fontWeight:'600', color: colors.neon.blue, marginBottom:14`
- `tabRow`: `flexDirection:'row', gap:8, marginBottom:14`
- `Tab` (active): `paddingVertical:8, paddingHorizontal:18, borderRadius:20, backgroundColor:'rgba(47,200,255,0.18)', borderWidth:1, borderColor: colors.neon.blue`, テキスト `color: colors.neon.blue, fontWeight:'700', fontSize:12`
- `Tab` (inactive): `borderWidth:1, borderColor: colors.text.muted, backgroundColor:'transparent'`, テキスト `color: colors.text.muted`
- `mealPhoto`: `height:110, borderRadius:12, backgroundColor: colors.bg.cardAlt`(グラデーション画像が無い場合のプレースホルダー)
- `InfoRow`: `flexDirection:'row', alignItems:'flex-start', gap:10, marginTop:12`、アイコン18x18、テキスト `fontSize:12, color: colors.text.primary, flex:1, lineHeight:18`

### 3.4 BottomNav

```tsx
<View style={styles.bottomNav}>
  {navItems.map(item => (
    <NavItem key={item.name} {...item} />
  ))}
</View>
```

- `bottomNav`: `flexDirection:'row', justifyContent:'space-between', paddingHorizontal:24, paddingVertical:14, backgroundColor: colors.bg.navBar, borderTopWidth:1, borderTopColor: colors.border.subtle`
- `NavItem`: アイコン(22x22 SVG) + ラベル(`fontSize:10, fontWeight:'600'`)
  - active: アイコン色 `colors.neon.blue`、`shadowColor: colors.neon.blue, shadowOpacity:0.8, shadowRadius:8`
  - inactive: アイコン色・ラベル色 `colors.text.muted`
- アイコン種別: Home(家), Journey(円+時計針), Workouts(ダンベル/クロス), Nutrition(リンゴ), Settings(ギア) — すべて`react-native-svg`の`<Path>`で実装(`stroke`のみ, `fill="none"`, `strokeWidth=2`)

---

## 4. 共通デザインシステムコンポーネント (`mobile/src/components/ui/`)

既存の `Button` 等が無ければ新規作成し、HomeScreen以外の画面でも再利用する。

### 4.1 Button

| variant | 背景 | 文字色 | 効果 |
|---|---|---|---|
| `primary` (青グロー) | `colors.neon.blue` | `#0A0E18` | `shadowColor: colors.neon.blue, shadowOpacity:0.5, shadowRadius:12` |
| `secondary` (グレー) | `#2A3142` | `colors.text.primary` | なし |

共通: `paddingVertical:14, paddingHorizontal:24, borderRadius:12, fontWeight:'700', fontSize:14`

### 4.2 StatusTag

楕円タグ。`paddingVertical:6, paddingHorizontal:14, borderRadius:20`

| label | 背景 | 文字色 | 用途 |
|---|---|---|---|
| Weight Loss | blue→orangeグラデーション(薄め, opacity 0.25) | `colors.neon.blue` | dietモード |
| Performance | `rgba(255,128,51,0.2)` | `colors.neon.orange` | performance重視 |
| Maintain & Sculpt | `rgba(74,222,128,0.2)` | `colors.neon.green` | maintainモード |

### 4.3 GoalIcon

各StatusTagに対応する22x22 SVGアイコン(`stroke`、対応色、`shadow`でグロー):
- Weight Loss → 胴体/体型アイコン
- Performance → 走る人アイコン
- Maintain & Sculpt → 力こぶ(バイセップ)アイコン

### 4.4 DataChart (折れ線+棒の複合グラフ)

`react-native-svg`の`<Path>`(折れ線, `stroke: colors.neon.blue, strokeWidth:2`)と`<Rect>`(棒, `fill: colors.neon.orange, opacity:0.6`)を同一`<Svg>`内に重ねて描画。週次の体重推移(線)とカロリー摂取量(棒)などのデータ系列を想定。X軸ラベルは `colors.text.muted, fontSize:10`。

### 4.5 AchievementMedal

円形バッジ(直径56)。中央にSVGアイコン(星/王冠/リング等)。
- 獲得済み: `backgroundColor: 'rgba(47,200,255,0.15)', borderWidth:2, borderColor: colors.neon.blue`, アイコン色 `colors.neon.blue`
- 未獲得: `backgroundColor: '#1A2030', borderWidth:2, borderColor: colors.text.muted, opacity:0.4`

既存の `/users/me/badges` APIレスポンス(バッジ一覧)をこのコンポーネントにマッピングする。

---

## 5. 実装方針メモ

1. `mobile/src/theme/colors.ts` を新規作成し、本仕様のトークンを定義。
2. `mobile/src/components/ui/` に `Button.tsx`, `StatusTag.tsx`, `AchievementMedal.tsx`, `icons/` (SVGアイコン群) を新規作成。
3. `HomeScreen.tsx` の `styles` を `colors` トークンベースで置き換え、構造は本仕様の3章に沿って再構成する。既存の状態管理・API呼び出し・モーダルは変更しない。
4. アバター画像 (`avatarImages[bodyState]`) は `AvatarSilhouette` の上に `<Image resizeMode="contain">` として重ねるか、Silhouetteを画像の背景グロー演出として残し画像を前面に出す形でも良い(要確認)。
5. ステータスバー: `StatusBar barStyle="light-content"` に変更(ダーク背景のため)。
