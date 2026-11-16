import meta from "@/data/ref/singapore.meta.json";

const SG_FOODID = "https://pphtpc.hpb.gov.sg/web/sgfoodid";
const SG_FOODID_TERMS = "https://file.go.gov.sg/termsofuse-hpbsgfoodid.pdf";

// Attribution required by the data licences (SG FoodID Terms of Use, section 11; KOGL Type 1; INDB citation).
export function DataNotice({ compact = false }: { compact?: boolean }) {
  const link = "underline";
  return (
    <div className={`text-ink-3 ${compact ? "text-[11px] leading-snug" : "text-xs"}`}>
      <p>
        Contains information from Singapore Food Insights Database (SG FoodID) accessed on {meta.accessed} from Health Promotion
        Board which is made available under the terms found at{" "}
        <a href={SG_FOODID} target="_blank" rel="noreferrer" className={link}>
          {SG_FOODID.replace("https://", "")}
        </a>{" "}
        (
        <a href={SG_FOODID_TERMS} target="_blank" rel="noreferrer" className={link}>
          licence
        </a>
        ). The information contained within this dataset is provided on an &quot;as-is&quot; basis. The data, including but not
        limited to nutritional information, is subject to inherent limitations. No warranty or representation is made as to the
        accuracy or completeness of the data contained herein.
      </p>
      {!compact && (
        <p className="mt-2">
          Also uses: Ministry of Food and Drug Safety (Korea) national food nutrition data (KOGL Type 1); Indian Nutrient Databank
          (Vijayakumar et al., Current Developments in Nutrition, 2024); USDA FoodData Central; Open Food Facts product data (openfoodfacts.org, Open Database License). Makan Log is not affiliated with or
          endorsed by any of these organisations.
        </p>
      )}
    </div>
  );
}
