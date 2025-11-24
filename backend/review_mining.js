// Enhanced happy hour detection from reviews and place details
function extractHappyHourFromReviews(reviews: any[]): any {
  const timePattern = /(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*(?:-|to|until)\s*(\d{1,2}(?::\d{2})?)\s*(?:am|pm)/gi;
  const dayPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|daily)/gi;
  const dealPattern = /(half\s*price|\$\d+|50%\s*off|2\s*for\s*1|buy\s*one\s*get\s*one|bogo)/gi;
  
  const happyHourInfo = {
    times: [],
    days: [],
    deals: [],
    confidence: 0
  };
  
  reviews.forEach(review => {
    const text = review.text?.toLowerCase() || '';
    
    // Look for happy hour mentions
    if (text.includes('happy hour')) {
      happyHourInfo.confidence += 30;
      
      // Extract times
      const timeMatches = text.match(timePattern);
      if (timeMatches) {
        happyHourInfo.times.push(...timeMatches);
        happyHourInfo.confidence += 20;
      }
      
      // Extract days
      const dayMatches = text.match(dayPattern);
      if (dayMatches) {
        happyHourInfo.days.push(...dayMatches);
        happyHourInfo.confidence += 15;
      }
      
      // Extract deals
      const dealMatches = text.match(dealPattern);
      if (dealMatches) {
        happyHourInfo.deals.push(...dealMatches);
        happyHourInfo.confidence += 25;
      }
    }
  });
  
  return happyHourInfo.confidence > 50 ? happyHourInfo : null;
}

// Usage in your existing getPlaceDetails function
async function getPlaceDetailsWithHappyHour(placeId: string) {
  const details = await getPlaceDetails(placeId);
  if (details?.reviews) {
    const happyHourInfo = extractHappyHourFromReviews(details.reviews);
    details.extracted_happy_hour = happyHourInfo;
  }
  return details;
}