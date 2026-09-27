import { SITE_TITLE } from "../../consts";
import { activeFamilies } from "../../lib/repos";
import { releaseFeed } from "../rss.xml.js";

export function getStaticPaths() {
  return activeFamilies.map((family) => ({ params: { family: family.id }, props: { family } }));
}

export function GET(context) {
  const { family } = context.props;
  return releaseFeed(context, {
    title: `${SITE_TITLE}: ${family.label}`,
    description: `Release notes for every ${family.label} repository.`,
    family: family.id,
  });
}
