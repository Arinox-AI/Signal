import "server-only";

import { z } from "zod";

import { resilientFetch } from "@/lib/http/request";
import type { CountryContext } from "@/lib/types/company";

const countrySchema = z.object({
  names: z.object({ common: z.string(), official: z.string() }),
  capitals: z.array(z.object({ name: z.string() })).optional(),
  region: z.string(),
  population: z.number(),
  flag: z
    .object({
      url_svg: z.string().url().optional(),
      url_png: z.string().url().optional(),
    })
    .optional(),
  currencies: z
    .array(z.object({ name: z.string(), symbol: z.string().optional() }))
    .optional(),
  languages: z.array(z.object({ name: z.string() })).optional(),
});

const responseSchema = z.object({
  data: z.object({ objects: z.array(countrySchema) }),
});

export async function getCountryContext(name: string): Promise<CountryContext> {
  const apiKey = process.env.REST_COUNTRIES_API_KEY;
  if (!apiKey) throw new Error("REST Countries API key is not configured.");

  const fields = "names,capitals,region,population,flag,currencies,languages";
  const endpoint = `https://api.restcountries.com/countries/v5/names.common/${encodeURIComponent(name)}?response_fields=${fields}`;
  const response = await resilientFetch(
    endpoint,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    { revalidate: 604_800 },
  );
  const country = responseSchema.parse(await response.json()).data.objects[0];
  if (!country) throw new Error("Country data was not found");
  return {
    name: country.names.common,
    officialName: country.names.official,
    capital: country.capitals?.[0]?.name ?? null,
    region: country.region,
    population: country.population,
    flagUrl: country.flag?.url_svg ?? country.flag?.url_png ?? null,
    currencies: (country.currencies ?? []).map((currency) =>
      currency.symbol ? `${currency.name} (${currency.symbol})` : currency.name,
    ),
    languages: (country.languages ?? []).map((language) => language.name),
  };
}
