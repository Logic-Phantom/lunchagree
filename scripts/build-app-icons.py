# 사용자 제공 아이콘 원본 한 장에서 앱 아이콘·로고·파비콘·OG 이미지를 잘라 만든다(다시 그리지 않음).
# 사잇 scripts/build-app-icons.py를 점심합의용으로 고친 것.
# 사용: python scripts/build-app-icons.py   (Pillow 필요: python -m pip install Pillow)
# 원본: assets/brand/icon-source.png (흰 캔버스 위 흰 둥근 사각 + '점심합의' 워드마크·포크·노란 포인트)
# 산출:
#   assets/brand/console-icon-600.png   앱인토스 콘솔 앱 로고(600×600, 흰 배경 꽉 참, 모서리 둥글림 없음, 투명 없음)
#   app/public/brand/logo.png           앱 안 브랜드 마크(512, 둥근 사각 밖은 투명)
#   app/public/brand/wordmark.png       글자만(투명 배경) — 홈 히어로·결과 화면
#   app/public/brand/og-image.png       공유 미리보기(1200×630, 흰 배경 가운데 아이콘)
#   app/public/favicon.png              브라우저 탭(64)
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'brand' / 'icon-source.png'


def main() -> None:
    src = Image.open(SRC).convert('RGB')

    # 1. 둥근 사각 찾기: 캔버스·아이콘이 모두 흰색 계열이고 그림자가 넓게 퍼져 채우기(floodfill)로는 경계가 새어 나간다.
    #    아이콘 테두리는 옅은 회색 선(밝기 ≤ 245)이다. 좌·우는 글자와 테두리 사이 흰 바탕(x=w/5, 4w/5)에서 바깥으로,
    #    위는 캔버스 위쪽에서 아래로(위쪽 그림자는 248 이상이라 걸리지 않음) 찾아 정사각으로 본다.
    gray = src.convert('L')
    w, h = gray.size

    def first_edge(points):
        return next(p for p in points if gray.getpixel(p) <= 245)

    left = first_edge([(x, h // 2) for x in range(w // 5, 0, -1)])[0]
    right = first_edge([(x, h // 2) for x in range(w * 4 // 5, w)])[0]
    top = first_edge([(w // 2, y) for y in range(h // 3)])[1]
    side = right - left
    crop = (left, top, left + side, top + side)
    box = (left, top, right)
    art = src.crop(crop).resize((1024, 1024), Image.LANCZOS)
    # 원본 모서리 반경(측정: 위 경계에서 2px 아래 행이 245/880 안쪽에서 시작) ≈ 한 변의 27%. 테두리 선·그림자는 10px 안쪽으로 잘라 버린다.
    shape = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(shape).rounded_rectangle((10, 10, 1013, 1013), radius=int(1024 * 0.27), fill=255)
    shape = shape.filter(ImageFilter.GaussianBlur(1.5))

    out_brand = ROOT / 'app' / 'public' / 'brand'
    out_brand.mkdir(parents=True, exist_ok=True)

    # 2. 콘솔 로고: 흰 배경 정사각(플랫폼이 둥글림을 직접 적용).
    #    아이콘 바탕은 순백이 아니라 246~254라 모서리만 흰색으로 채우면 둥근 사각이 남는다(콘솔 반려, D-053) → 밝기 244 이상을 순백으로 편다.
    full = Image.composite(art, Image.new('RGB', art.size, (255, 255, 255)), shape)
    console = full.resize((600, 600), Image.LANCZOS).point(lambda v: 255 if v >= 244 else v * 255 // 244)
    console.save(ROOT / 'assets' / 'brand' / 'console-icon-600.png', optimize=True)

    # 3. 앱 안 로고: 둥근 사각 유지, 바깥 투명.
    logo = art.convert('RGBA')
    logo.putalpha(shape)
    logo.resize((512, 512), Image.LANCZOS).save(out_brand / 'logo.png', optimize=True)

    # 4. 파비콘.
    logo.resize((64, 64), Image.LANCZOS).save(ROOT / 'app' / 'public' / 'favicon.png', optimize=True)

    # 5. OG 이미지: 흰 카드 가운데 아이콘(글자 추가 없음 — 플랫폼이 앱 이름을 직접 표시).
    og = Image.new('RGB', (1200, 630), (255, 255, 255))
    icon = full.resize((420, 420), Image.LANCZOS)
    og.paste(icon, ((1200 - 420) // 2, (630 - 420) // 2))
    og.save(out_brand / 'og-image.png', optimize=True)

    # 6. 워드마크: 진한 남색 글자 + 노란 포인트만 남기고 투명. 아이콘 바탕은 거의 흰색이므로
    #    알파 = max(어두운 정도, 채도). 노란색(채도 높음)과 남색(밝기 낮음)을 모두 잡는다.
    rgb = art.copy()
    r, g, b = rgb.split()
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    spread = ImageChops.subtract(hi, lo)
    darkness = ImageChops.invert(hi)
    strength = ImageChops.lighter(spread, darkness)
    alpha = strength.point(lambda v: 0 if v < 30 else min(255, (v - 30) * 4))
    letters_box = alpha.point(lambda v: 255 if v > 200 else 0).getbbox()
    pad = 16
    lb = (letters_box[0] - pad, letters_box[1] - pad, letters_box[2] + pad, letters_box[3] + pad)
    word = rgb.convert('RGBA')
    word.putalpha(alpha)
    word = word.crop(lb)
    word.thumbnail((640, 640), Image.LANCZOS)
    word.save(out_brand / 'wordmark.png', optimize=True)

    print('icon box', box, '→', crop, 'letters', lb)


if __name__ == '__main__':
    main()
