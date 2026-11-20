// Default photos for the city tiles on the Dealers page, from Wikimedia Commons (free licences,
// credited on the page). Admins can replace any of them, or add one for a city that has none,
// in Admin → Configuration → City photos; their uploads take priority.
// A city without a photo shows a simple illustration.

const commons = (file) => `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;
const page = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;

export const DEFAULT_CITY_PHOTOS = {
  'Dar es Salaam': { file: 'Dar_es_Salaam_City_Skyline.jpg', subject: 'City centre skyline', author: 'Muhammad Mahdi Karim', license: 'GFDL 1.2' },
  Dodoma: { file: 'Street_in_Viwandani_ward,_Dodoma_City.jpg', subject: 'A street in Dodoma', author: 'Mangapwani', license: 'CC BY-SA 4.0' },
  Mwanza: { file: 'Bismarck_Rock.jpg', subject: 'Bismarck Rock, Lake Victoria' },
  Mbeya: { file: 'Mbeya_Tanzania.jpg', subject: 'Mbeya and its mountains' },
  Moshi: { file: 'Moshi_panorama_edit1.jpg', subject: 'Moshi with Kilimanjaro' },
  Morogoro: { file: 'Morogoro_panorama.jpg', subject: 'Morogoro and the mountains' },
};

/**
 * The photo for a city's tile: an admin upload first, then the default photo.
 * @returns {{ url: string, credit?: object } | null}
 */
export function cityPhoto(city, config) {
  const uploaded = config?.cityImages?.[city];
  if (uploaded) return { url: uploaded };
  const d = DEFAULT_CITY_PHOTOS[city];
  return d ? { url: commons(d.file), credit: { ...d, city, page: page(d.file) } } : null;
}
