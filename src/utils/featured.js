// A listing is featured while its boost lasts (featuredUntil), or indefinitely if no end date was set.
export const isFeatured = (v) => !!v?.featured && (!v.featuredUntil || new Date(v.featuredUntil) > new Date());
