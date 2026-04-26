import { Link } from "@heroui/link";
import { Code } from "@heroui/code";
import { button as buttonStyles } from "@heroui/theme";
import { Card, CardBody, CardHeader } from "@heroui/card";

import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";

export default function FixPinkYoutube() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 ">
      <div className="inline-block max-w-2xl text-center justify-center font-mono">
        <span className={title()}>Fix&nbsp;</span>
        <span className={title({ color: "violet" })}>Pink&nbsp;</span>
        <span className={title()}>YouTube</span>
        <div className={subtitle({ class: "mt-4" })}>
          A browser add-on to make YouTube red again
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <Link
          isExternal
          className={buttonStyles({ variant: "bordered", radius: "full", color: "danger" })}
          href="https://addons.mozilla.org/en-US/firefox/addon/fix-pink-youtube-progress/"
        >
          🦊 Firefox
        </Link>
        <Link
          isExternal
          className={buttonStyles({ variant: "bordered", radius: "full", color: "primary" })}
          href="https://chromewebstore.google.com/detail/fix-pink-youtube/fengeoelhgcghmjbjpnmaklomofhdanj"
        >
          🌐 Chrome
        </Link>
        <Link
          isExternal
          className={buttonStyles({ variant: "bordered", radius: "full" })}
          href="https://github.com/GREEB/fix-pink-youtube"
        >
          <GithubIcon size={20} />
          GitHub
        </Link>
      </div>

      <div className="mt-8 max-w-4xl w-full px-4">
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-bold">What does it do?</h2>
          </CardHeader>
          <CardBody className="gap-4">
            <p>
              This extension restores YouTube&apos;s classic red color scheme by
              changing:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Progress bar in the main video player</li>
              <li>Progress bar in video thumbnails</li>
              <li>Other UI elements to match YouTube&apos;s pre-2023 red theme</li>
            </ul>
          </CardBody>
        </Card>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">Player Progress Bar</h3>
            </CardHeader>
            <CardBody>
              <img
                src="https://raw.githubusercontent.com/GREEB/fix-pink-youtube/main/media/fix-player.png"
                alt="Fixed player progress bar showing red color"
                className="rounded-lg w-full"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">Thumbnail Progress Bar</h3>
            </CardHeader>
            <CardBody>
              <img
                src="https://raw.githubusercontent.com/GREEB/fix-pink-youtube/main/media/fix-thumbnail.png"
                alt="Fixed thumbnail progress bar showing red color"
                className="rounded-lg w-full"
              />
            </CardBody>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-2xl font-bold">Color Reference</h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4">
              To ensure authenticity, we use colors from a{" "}
              <Link
                href="https://web.archive.org/web/20230705011417/https://www.youtube.com/"
                isExternal
                color="secondary"
              >
                May 7, 2023 snapshot
              </Link>
              {" "}from archive.org
            </p>
            <div className="bg-default-100 p-4 rounded-lg overflow-x-auto">
              <Code className="text-sm">
                {`--yt-brand-youtube-red: #f00;
--yt-brand-medium-red: #c00;
--yt-brand-light-red: #ff4e45;
--yt-spec-brand-button-background: #c00;
--yt-spec-brand-button-background-hover: #990412;`}
              </Code>
            </div>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-2xl font-bold">Development</h2>
          </CardHeader>
          <CardBody className="gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">🛠 Build locally</h3>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Clone the repository</li>
                <li>Run <Code>npm install</Code> to install dependencies</li>
                <li>Run <Code>npm run build</Code></li>
              </ol>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">🏃 Run the extension</h3>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Run <Code>npm run watch</Code> to watch for changes</li>
                <li>Run <Code>npm install --global web-ext</Code> (first time only)</li>
                <li>Run <Code>web-ext run -t chromium</Code> in another terminal</li>
              </ol>
            </div>
            <div className="mt-4">
              <Link
                href="https://github.com/GREEB/fix-pink-youtube"
                isExternal
                color="success"
              >
                <GithubIcon className="mr-2" />
                View on GitHub for full documentation
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}