import { supabase } from "./supabaseClient";
import type { ListingResult } from "./api";

// Fetch all saved listings from Supabase for the current user
export async function fetchSavedListings() {
  const { data, error } = await supabase
    .from("user_saved_listings")
    .select("listing");

  if (error) {
    console.error("Error fetching saved listings from cloud:", error);
    throw error;
  }

  // extract the inner listing objects
  return (data || []).map((row: any) => row.listing as ListingResult);
}

// Add a single listing to Supabase
export async function saveListingToCloud(listing: ListingResult) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("user_saved_listings")
    .insert({
      user_id: user.id,
      listing: listing
    });

  if (error && error.code !== "23505") { // ignore unique key duplicate errors
    console.error("Error saving listing to cloud:", error);
    throw error;
  }
}

// Remove a listing from Supabase by its unique name
export async function deleteListingFromCloud(listingName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("user_saved_listings")
    .delete()
    .eq("user_id", user.id)
    .eq("listing->>name", listingName);

  if (error) {
    console.error("Error deleting listing from cloud:", error);
    throw error;
  }
}

// Merge localStorage listings into Supabase on first login
export async function syncLocalSavesToCloud(localSaves: ListingResult[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || localSaves.length === 0) return;

  // We batch insert all of them. To handle duplicates gracefully, we can do it one by one 
  // or use upsert if we have a unique constraint matching on user_id + listing->>name.
  // Since we have the unique index saved_user_listing_idx, inserting one-by-one or checking is simple.
  const promises = localSaves.map(async (listing) => {
    const { error } = await supabase
      .from("user_saved_listings")
      .insert({
        user_id: user.id,
        listing: listing
      });
    if (error && error.code !== "23505") {
      console.error(`Failed to sync listing "${listing.name}":`, error);
    }
  });

  await Promise.all(promises);
}
