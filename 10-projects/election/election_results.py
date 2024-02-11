import json
import numpy as np
import overpy
import pandas as pd
import streamlit as st


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
fips_center = pd.read_csv("fips-county-center.csv", dtype={"fips_code": str})
with open("election_results_by_fips.json") as f:
    fips_results = json.load(f)

# create an input box to get the store name
store_name = st.text_input("Enter the store name")

# get the locations of the store
if store_name:
    print(store_name)
    locations = get_locations(store_name)
    if len(locations) == 0:
        st.write(f"No stores found with the name {store_name}")
    else:
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
        results_df["Biden"] = [result["bidenj"] for result in results]
        results_df["Trump"] = [result["trumpd"] for result in results]
        results_df["Winner"] = ["Biden" if result["bidenj"] > result["trumpd"] else "Trump" for result in results]
        biden_wins = results_df["Winner"].value_counts()["Biden"]
        trump_wins = results_df["Winner"].value_counts()["Trump"]
        # display how many stores voted for each candidate
        st.write(f"{biden_wins:,} {store_name} stores voted for Biden ({biden_wins / (biden_wins + trump_wins):.1%}) and {trump_wins:,} stores voted for Trump ({trump_wins / (biden_wins + trump_wins):.1%})")