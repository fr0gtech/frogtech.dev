import { Link } from "@heroui/link";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { button as buttonStyles } from "@heroui/theme";
import { Card, CardBody, CardHeader } from '@heroui/card'
import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-xl text-center justify-center font-mono">
        <span className={title()}>Creating&nbsp;</span>
        <span className={title({ color: "violet" })}>modern&nbsp;</span>
        <br />
        <span className={title()}>media apps.</span>
        <div className={subtitle({ class: "mt-4" })}>
          Join:{" "}
          <Code>
            <span className="hidden">google: caesar cypher</span>
            uggcf://qvfpbeq.tt/nvagabjnllbhpyvpxgungzhpu
          </Code>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          isExternal
          className={buttonStyles({ variant: "bordered", radius: "full" })}
          href={siteConfig.links.github}
        >
          <GithubIcon size={20} />
          GitHub
        </Link>
      </div>

      <div className="mt-8 flex gap-5">
        <Card className="max-w-[250px]">
          <CardHeader>
            <Link href="https://sub-sunday.com" color="foreground">
              <h2 className="text-xl">sub-sunday.com</h2>
            </Link>
          </CardHeader>
          <CardBody>
            Tracking votes for liriks subsunday
            <div className="px-3 mt-5">
              <Link href="https://github.com/frogtech/subsunday-front" color="success">
                <GithubIcon className="mr-3" />
                <span>subsunday-front</span>
              </Link>
            </div>
            <div className="px-3 mt-2">
              <Link href="https://github.com/frogtech/subsunday-back" color="warning">
                <GithubIcon className="mr-3" />
                <span>subsunday-back</span>
              </Link>
            </div>
          </CardBody>
        </Card>
        <Card className="max-w-[250px]">
          <CardHeader>
            <Link href="https://sub-sunday.com" color="foreground">
              <h2 className="text-xl">spoty-stalk</h2>
            </Link>
          </CardHeader>
          <CardBody>
            Stalk someones public spotify playlist and souncloud likes

            <div className="px-3 mt-5">
              <Link href="https://github.com/frogtech/spoty-stalk" color="success">
                <GithubIcon className="mr-3" />
                <span>spoty-stalk</span>
              </Link>
            </div>

          </CardBody>
        </Card>
      </div>
      <div className="flex gap-2">
        <Card>
          <CardHeader>
            <Link href="https://github.com/fr0gtech/twitch-vod-chat-downloader" color="secondary">
              <GithubIcon className="mr-3" />
              <span>twitch-vod-chat-downloader</span>
            </Link>
          </CardHeader>
          <CardBody>
            <p>Download chats from twitch</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <Link href="https://github.com/fr0gtech/frogBump" color="secondary">
              <GithubIcon className="mr-3" />
              <span>frogbump</span>
            </Link>
          </CardHeader>
          <CardBody>
            <p>Random video player made in unity </p>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
