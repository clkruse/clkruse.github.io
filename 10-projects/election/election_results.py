import json
import numpy as np
import overpy
import pandas as pd
import requests
import streamlit as st
from openai import OpenAI
import pydeck as pdk


def parse_store_name(store_name):
    # Use OpenAI to convert the store name to the OSM name
    # For example, "whole foods" -> "Whole Foods Market"

    client = OpenAI(api_key=st.secrets["OPENAI_KEY"])
    #client = OpenAI(api_key="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")
    response = client.chat.completions.create(
        model="gpt-3.5-turbo-0125",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "You convert unstructured names of stores to their name on OpenStreetMap in JSON format.",
            },
            {"role": "user", "content": "The OSM name for " + store_name + " is "},
        ],
    )
    try:
        name = json.loads(response.choices[0].message.content)["osm_name"]
        return name
    except:
        print(response.choices[0].message.content)
        return store_name


def get_locations(store_name):

    # Define the Overpass query
    query = """
    [out:json];
    area["ISO3166-1"="US"]->.boundaryarea;
    node["name"="{store_name}"](area.boundaryarea);
    out;
    """.format(store_name=store_name)
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
fips_center = pd.read_csv(
    "https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/election/fips-county-center.csv",
    dtype={"fips_code": str},
)
results = requests.get(
    "https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/election/election_results_by_fips.json"
)
# load the json data
fips_results = json.loads(results.text)

# create a title
st.title("If stores could vote...")
st.write(
    "If you're standing in a Whole Foods, what are the odds that the county you're in voted for Biden? What about a Dollar General? I was curious, so I built a tool to find the election results for any store in the US."
)
st.write(
    "Enter the name of a store and I'll show you how counties with that store voted. Note that stores are often built in cities, and cities tend to vote for Democrats. Anything that shows > 50% for Trump is generally an interesting finding."
)

# create an input box to get the store name
store_name = st.text_input("Enter a store name")

# get the locations of the store
if store_name:
    store_name = parse_store_name(store_name)
    locations = get_locations(store_name)
    if len(locations) == 0:
        st.write(f"No stores found with the name {store_name}")
    else:
        st.write(f"Found {len(locations)} stores with the name {store_name}")
        locations_df = pd.DataFrame(locations, columns=["lon", "lat"])
        # get the fips code for each location
        fips_codes = []
        for i in range(len(locations)):
            fips_codes.append(get_fips(locations[i][0], locations[i][1]))

        # get the election results for each fips code
        results = []
        for fips in fips_codes:
            if fips in fips_results:
                results.append(fips_results[fips])
            else:
                st.write(f"No election results found for {fips}")
                locations.pop(fips_codes.index(fips))
                fips_codes.remove(fips)
                results.append({"bidenj": 0, "trumpd": 0}) # I do not know why I need to add this

        results_df = pd.DataFrame(locations, columns=["lon", "lat"])
        results_df["FIPS"] = fips_codes
        results_df["Biden"] = [result["bidenj"] for result in results]
        results_df["Trump"] = [result["trumpd"] for result in results]
        results_df["Winner"] = [
            "Biden" if result["bidenj"] > result["trumpd"] else "Trump"
            for result in results
        ]
        # de-duplicate based on fips code
        results_df = results_df.drop_duplicates(subset="FIPS")
        # check if one candidate won all of the counties
        if len(results_df["Winner"].unique()) == 1:
            st.write(
                f"All {len(results_df)} counties with a {store_name} voted for {results_df['Winner'].unique()[0]}"
            )
        else:
            biden_wins = results_df["Winner"].value_counts()["Biden"]
            trump_wins = results_df["Winner"].value_counts()["Trump"]
            # display how many stores voted for each candidate
            st.write(
                f"{biden_wins:,} counties with a {store_name} voted for Biden ({biden_wins / (biden_wins + trump_wins):.1%}) and {trump_wins:,} voted for Trump ({trump_wins / (biden_wins + trump_wins):.1%})"
            )
        # set colors for points. If the county voted for Biden, make it blue. If it voted for Trump, make it red.
        results_df['color'] = [[36, 73, 153] if winner == "Biden" else [210, 37, 50] for winner in results_df["Winner"]]
        # make a map
        st.pydeck_chart(
            pdk.Deck(
                map_style="mapbox://styles/mapbox/light-v9",
                initial_view_state=pdk.ViewState(
                    latitude=38,
                    longitude=-99,
                    zoom=3,
                    pitch=0,
                ),
                layers=[
                    pdk.Layer(
                        "ScatterplotLayer",
                        data=results_df,
                        get_position=["lon", "lat"],
                        get_radius=15000,
                        get_fill_color="color",
                    ),
                ],
            ),
            # set full width
            use_container_width=True,
        )


footer = """<style>
.footer {
position: fixed;
left: 0;
bottom: 0;
width: 100%;
background-color: white;
color: black;
text-align: center;
}
</style>
<div class="footer">
<p>Made by <a href="https://calebkruse.com/" target="_blank">Caleb Kruse</a></p>
</div>
"""
st.markdown(footer, unsafe_allow_html=True)
