# Nanites

Move your cursor across an image to scatter its fragments into particles. They drift briefly, then spring back into place.

A small React component using Canvas 2D. No animation library, backend, account or API key required.

## Run the demo

Use Node 22.13 or newer.

```sh
npm ci
npm run dev
```

The demo includes the Cayo logo and a local image picker. Selected images stay in the browser; there is no upload endpoint or analytics. Transparent PNG, SVG and WebP files work best. The picker accepts images up to 5 MB, with aspect ratios from 1:2 to 20:1.

## Usage

Copy `src/nanites.tsx` and `src/nanites.css` into your React project. Requires React 18 or newer; the demo is tested with React 19.

```tsx
import { Nanites } from './nanites';
import './nanites.css';

export function Brand() {
  return (
    <Nanites
      src="/your-logo.svg"
      alt="Your brand"
      width={1000}
      height={190}
    />
  );
}
```

Use the image's natural dimensions for `width` and `height`. It scales to its container. Place it in a wrapper to control its maximum width. The component includes vertical padding so the fragments have room to move.

| Prop | Purpose |
| --- | --- |
| `src` | URL of transparent artwork served from your own origin. |
| `alt` | Accessible image description. Use an empty string for purely decorative images. |
| `width`, `height` | Intrinsic image dimensions, used to reserve layout space. |
| `className` | Optional class on the container. |
| `disabled` | Set to `true` to stop the effect and show the original image. |

Remote images without canvas access remain static. For reliable animation, serve the image with your application. Opaque backgrounds are sampled as part of the artwork, so transparent images produce a cleaner effect.

The component contains the `use client` directive for React frameworks that distinguish server and client components. It uses a normal image element and does not require Next.js.

## Motion and accessibility

- Hover starts the effect only for fine pointers. Touch keeps the image still.
- The operating system's reduced-motion preference keeps the original image visible.
- No content or action is hidden behind the animation. The canvas is decorative and excluded from the accessibility tree.
- Animation stops when the document is hidden, when the element leaves its observer region, or when the component unmounts.
- Each patch returns in about 3.6 seconds. Rapid sweeps fill gaps between pointer events.
- Device pixel ratio is capped at 2. Sampling is capped at 1,000 pixels wide. Rendering uses the main thread; profile it with your actual image and target devices.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The tests exercise reassembly, fast cursor sweeps, reduced motion, touch behavior, canvas failure and cleanup. They use a simulated canvas and do not measure browser rendering performance.

## Hosting the demo

`npm run build` produces a static site in `dist/`. Relative asset URLs let it run at a repository subpath as well as a domain root.

The included GitHub Pages workflow runs checks on pull requests and deploys only on a push to `main`, or a manual run on `main`. Configure the repository's Pages publishing source as **GitHub Actions** before deploying. A pull request does not publish the demo.

## License

The code is MIT licensed. The Cayo logo in `public/cayo-logo.svg` is included for this demo only and is not covered by the MIT license. The Cayo and Plainsight names and branding remain reserved. Substitute artwork you have permission to use in your own project.
