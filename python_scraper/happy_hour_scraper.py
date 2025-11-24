#!/usr/bin/env python3
"""
Happy Hour Web Scraper
Scrapes restaurant websites for happy hour information
"""

import requests
from bs4 import BeautifulSoup
import re
import json
from urllib.parse import urljoin, urlparse
import time
import random

class HappyHourScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def scrape_happy_hour(self, website_url):
        """Main scraping function for happy hour info"""
        try:
            # Get main page
            response = self.session.get(website_url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for happy hour links
            happy_hour_links = self.find_happy_hour_links(soup, website_url)
            
            happy_hour_info = {
                'website': website_url,
                'found_info': False,
                'times': [],
                'days': [],
                'deals': [],
                'raw_text': []
            }
            
            # Scrape main page
            self.extract_happy_hour_info(soup, happy_hour_info)
            
            # Scrape dedicated happy hour pages
            for link in happy_hour_links:
                try:
                    response = self.session.get(link, timeout=10)
                    page_soup = BeautifulSoup(response.content, 'html.parser')
                    self.extract_happy_hour_info(page_soup, happy_hour_info)
                    time.sleep(random.uniform(1, 3))  # Be respectful
                except:
                    continue
            
            return happy_hour_info
            
        except Exception as e:
            return {'error': str(e), 'website': website_url}
    
    def find_happy_hour_links(self, soup, base_url):
        """Find links that might contain happy hour info"""
        keywords = ['happy-hour', 'happyhour', 'specials', 'deals', 'promotions', 'events']
        links = []
        
        for link in soup.find_all('a', href=True):
            href = link['href'].lower()
            text = link.get_text().lower()
            
            if any(keyword in href or keyword in text for keyword in keywords):
                full_url = urljoin(base_url, link['href'])
                links.append(full_url)
        
        return list(set(links))  # Remove duplicates
    
    def extract_happy_hour_info(self, soup, info_dict):
        """Extract happy hour information from soup"""
        text = soup.get_text().lower()
        
        # Time patterns
        time_patterns = [
            r'(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))',
            r'(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:pm|am)'
        ]
        
        # Day patterns
        day_patterns = [
            r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
            r'(weekday|weekend|daily|mon-fri|m-f)'
        ]
        
        # Deal patterns
        deal_patterns = [
            r'\$\d+(?:\.\d{2})?\s+(?:drinks|cocktails|beer|wine)',
            r'(?:half\s*price|50%\s*off|2\s*for\s*1|buy\s*one\s*get\s*one)',
            r'\$\d+\s+(?:happy\s*hour|specials)'
        ]
        
        # Extract times
        for pattern in time_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            info_dict['times'].extend(matches)
        
        # Extract days
        for pattern in day_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            info_dict['days'].extend(matches)
        
        # Extract deals
        for pattern in deal_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            info_dict['deals'].extend(matches)
        
        # Look for happy hour sections
        happy_hour_sections = soup.find_all(text=re.compile(r'happy\s*hour', re.IGNORECASE))
        if happy_hour_sections:
            info_dict['found_info'] = True
            for section in happy_hour_sections[:3]:  # Limit to first 3
                parent = section.parent
                if parent:
                    info_dict['raw_text'].append(parent.get_text().strip())

# Example usage
if __name__ == "__main__":
    scraper = HappyHourScraper()
    
    # Test with a restaurant website
    test_url = "https://example-restaurant.com"
    result = scraper.scrape_happy_hour(test_url)
    print(json.dumps(result, indent=2))