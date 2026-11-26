"""Converte SVGs exportados do Figma em componentes React (currentColor)."""
import re, sys, os, json
SRC = sys.argv[1]
OUT = sys.argv[2]
# nome do componente -> (arquivo, monocromático?)
MAP = {
  'SearchIcon': ('icons2/search-icon-20x20__I70522_3240_70504_3017_70504_3013.svg', True),
  'CartIcon': ('icons2/cart-icon-24x24__I70522_3240_70504_3015_70504_3012.svg', True),
  'LogoutIcon': ('icons/logo-20x20-iconly-curved-logout.svg', True),
  'ChevronDownIcon': ('icons/iconly-two-tone-arrow-down-2.svg', True),
  'ArrowRightIcon': ('icons/iconly-curved-arrow-right.svg', True),
  'ArrowLeftIcon': ('icons/iconly-curved-arrow-left-2.svg', True),
  'ChevronRightIcon': ('icons/iconly-curved-arrow-right-2.svg', True),
  'StarIcon': ('icons/iconly-bold-star.svg', True),
  'HeartIcon': ('icons2/heart-1-20x20__70410_3940.svg', True),
  'LinkedinIcon': ('icons2/linkedin-15x14__11_1245.svg', True),
  'MailIcon': ('icons2/message-18x18__11_1248.svg', True),
  'TwitterIcon': ('icons2/twitter-16x12__11_1247.svg', True),
  'TrashIcon': ('icons/iconly-curved-delete.svg', True),
  'EyeOffIcon': ('icons/iconly-light-outline-hide.svg', True),
  'CloseIcon': ('icons/x.svg', True),
  'UserIcon': ('icons/user.svg', True),
  'LocationIcon': ('icons/iconly-light-outline-location.svg', True),
  'ActivityIcon': ('icons/iconly-curved-activity.svg', True),
  'DownloadIcon': ('icons/iconly-curved-download.svg', True),
  'WarningIcon': ('icons/iconly-curved-danger-triangle.svg', True),
  'ImageIcon': ('icons/iconly-curved-image-2.svg', True),
  'HomeIcon': ('icons/iconly-bold-home.svg', True),
  'ShopIcon': ('icons/shop.svg', True),
  'FilterIcon': ('icons/iconly-curved-filter.svg', True),
  'WalletIcon': ('icons/iconly-curved-wallet.svg', True),
  'ShoppingBagIcon': ('icons2/shopping-1-18x18__70420_4547.svg', True),
  'HeartOutlineSmallIcon': ('icons2/heart-1-16x16__70420_4551.svg', True),
  'FacebookSquareIcon': ('icons2/frame-108-30x30__I70492_696_70491_1269.svg', True),
  'InstagramSquareIcon': ('icons2/frame-109-30x30__I70492_696_70491_1271.svg', True),
  'TwitterSquareIcon': ('icons2/frame-110-30x30__I70492_696_70491_1273.svg', True),
  'LinkedinSquareIcon': ('icons2/frame-111-30x30__I70492_696_70491_1275.svg', True),
  'YoutubeSquareIcon': ('icons2/frame-112-30x30__I70492_696_70491_1277.svg', True),
  'GoogleIcon': ('icons2/google-1-20x20__I70484_260_70483_242.svg', False),
  'FacebookIcon': ('icons2/facebook-1-20x20__I70484_240_70483_259.svg', False),
  'ThankYouIcon': ('icons/thank-you.svg', True),
  'LogoWordmark': ('icons/logo-160x34-logo.svg', True),
}
ATTR = {'stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin','fill-rule':'fillRule','clip-rule':'clipRule','clip-path':'clipPath','stroke-miterlimit':'strokeMiterlimit','fill-opacity':'fillOpacity','stroke-opacity':'strokeOpacity','stop-color':'stopColor','stop-opacity':'stopOpacity','xlink:href':'xlinkHref','color-interpolation-filters':'colorInterpolationFilters','flood-opacity':'floodOpacity','stroke-dasharray':'strokeDasharray'}
files = {os.path.basename(f) for f in os.listdir(os.path.join(SRC,'icons2'))}
def find(path):
    full = os.path.join(SRC, path)
    if os.path.exists(full): return full
    d, base = os.path.split(path)
    pref = base.split('__')[0]
    for f in os.listdir(os.path.join(SRC, d)):
        if f.startswith(pref): return os.path.join(SRC, d, f)
    raise SystemExit('missing '+path)
out = ["/* Gerado por scripts/build-icons.py a partir dos SVGs exportados do Figma (Iconly + marca Kurio). Não editar à mão. */",
       "import type { SVGProps } from 'react'", "",
       "export type IconProps = SVGProps<SVGSVGElement> & { title?: string }", ""]
for name, (path, mono) in MAP.items():
    svg = open(find(path)).read()
    m = re.search(r'<svg([^>]*)>(.*)</svg>', svg, re.S)
    attrs, body = m.group(1), m.group(2).strip()
    w = re.search(r'width="([\d.]+)"', attrs).group(1); h = re.search(r'height="([\d.]+)"', attrs).group(1)
    vb = re.search(r'viewBox="([^"]+)"', attrs).group(1)
    if mono:
        body = re.sub(r'(fill|stroke)="(#[0-9A-Fa-f]{3,8}|white|black)"', r'\1="currentColor"', body)
    # ids únicos
    ids = re.findall(r'id="([^"]+)"', body)
    for i in ids:
        nid = f'{name}-{i}'
        body = body.replace(f'id="{i}"', f'id="{nid}"').replace(f'url(#{i})', f'url(#{nid})').replace(f'href="#{i}"', f'href="#{nid}"')
    for k, v in ATTR.items(): body = body.replace(k+'=', v+'=')
    body = re.sub(r'style="[^"]*"', '', body)
    out.append(f"export function {name}({{ title, ...props }}: IconProps) {{")
    out.append(f"  return (")
    out.append(f"    <svg width={{{w}}} height={{{h}}} viewBox=\"{vb}\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden={{title ? undefined : true}} role={{title ? 'img' : undefined}} focusable=\"false\" {{...props}}>")
    out.append("      {title ? <title>{title}</title> : null}")
    for line in body.splitlines(): out.append('      '+line.strip())
    out.append("    </svg>\n  )\n}\n")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT,'w').write('\n'.join(out))
print('ok', len(MAP))
