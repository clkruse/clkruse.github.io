import json
import numpy as np
import overpy
import pandas as pd
import requests
import streamlit as st
from openai import OpenAI

def parse_store_name(store_name):
    # Use OpenAI to convert the store name to the OSM name
    # For example, "whole foods" -> "Whole Foods Market"

    client = OpenAI(api_key= st.secrets["OPENAI_KEY"])
    response = client.chat.completions.create(
        model="gpt-3.5-turbo-0125",
        response_format={ "type": "json_object" },
        messages=[
            {"role": "system", "content": "You convert unstructured names of stores to their name on OpenStreetMap in JSON format."},
            {"role": "user", "content": "The OSM name for " + store_name[:100] + " is "},
        ],
        max_tokens=20,
    )
    return json.loads(response.choices[0].message.content)['osm_name']

def get_locations(store_name):
    # Define the bounding box coordinates for the mainland US
    bbox = (24, -128, 50, -66.0)

    # Convert the bounding box coordinates to Overpass API format
    bbox_str = ",".join(map(str, bbox))

    # Define the Overpass query
    query = """
    [out:json];
    node["name"="{store_name}"]({bbox});
    out;
    """.format(
        bbox=bbox_str, store_name=store_name
    )
    print(query)
    # Create Overpass API object
    api = overpy.Overpass()

    # Send the query to Overpass API
    result = api.query(query)

    # Extract the locations
    locations = []
    for node in result.nodes:
        locations.append([float(node.lon), float(node.lat)])
    return locations


def get_fips(lon, lat):
    # find point closest to the input coordinates
    distances = np.sqrt(
        (fips_center["lng"] - lon) ** 2 + (fips_center["lat"] - lat) ** 2
    )
    closest = fips_center.iloc[distances.idxmin()]
    return closest["fips_code"]


# Load the fips data
fips_center = pd.read_csv("https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/election/fips-county-center.csv", dtype={"fips_code": str})
results = requests.get("https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/election/election_results_by_fips.json")
# load the json data
fips_results = json.loads(results.text)


# create an input box to get the store name
store_name = st.text_input("Enter the store name")

# get the locations of the store
if store_name:
    store_name = parse_store_name(store_name)
    locations = get_locations(store_name)
    if len(locations) == 0:
        st.write(f"No stores found with the name {store_name}")
    else:
        st.write(f"Found {len(locations)} stores with the name {store_name}")
        # create a locations dataframe
        locations_df = pd.DataFrame(locations, columns=["lon", "lat"])
        # create a map
        st.map(locations_df)

        # get the fips code for each location
        fips_codes = []
        for i in range(len(locations)):
            fips_codes.append(get_fips(locations[i][0], locations[i][1]))

        # get the election results for each fips code
        results = []
        for fips in fips_codes:
            results.append(fips_results[fips])
        results_df = pd.DataFrame(locations, columns=["lon", "lat"])
        results_df["FIPS"] = fips_codes
        results_df["Biden"] = [result["bidenj"] for result in results]
        results_df["Trump"] = [result["trumpd"] for result in results]
        results_df["Winner"] = ["Biden" if result["bidenj"] > result["trumpd"] else "Trump" for result in results]
        # de-duplicate based on fips code
        results_df = results_df.drop_duplicates(subset="FIPS")
        # check if one candidate won all of the counties
        if len(results_df["Winner"].unique()) == 1:
            st.write(f"All {len(results_df)} counties with a {store_name} voted for {results_df['Winner'].unique()[0]}")
        else:
            biden_wins = results_df["Winner"].value_counts()["Biden"]
            trump_wins = results_df["Winner"].value_counts()["Trump"]
            # display how many stores voted for each candidate
            st.write(f"{biden_wins:,} counties with a {store_name} voted for Biden ({biden_wins / (biden_wins + trump_wins):.1%}) and {trump_wins:,} voted for Trump ({trump_wins / (biden_wins + trump_wins):.1%})")