import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import Navbar from "@/components/Navbar";
import spotsBg from "@/assets/spots.png";
import Filterbar from "@/components/Filterbar";
import Sidebar from "@/components/Sidebar";
import getSearchUrl from "@/utils/getSearchUrl";
import { getDogIds } from "@/utils/getDogIds";
import { getDogsData } from "@/utils/getDogsData";
import { Filters } from "@/components/Filters";
import Error from "@/components/Error";
import PaginationSearch from "@/components/PaginationSearch";
import Cards from "@/components/Cards";
import { useLocation, type Location as RouterLocation } from "react-router-dom";
import Badge from "@/components/ui/badge";
import { Funnel, SlidersHorizontal } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import Modal from "@/components/Modal";
import type { FavoritesState } from "@/AuthProvider";

export type FiltersState = {
  search: string[];
  breeds: string[];
  ageMin: number;
  ageMax: number;
};

export type SortState = {
  sortBy: string;
  orderBy: string;
};

export interface Dog {
  id: string;
  img: string;
  name: string;
  age: number;
  zip_code: string;
  breed: string;
  city: string;
  county: string;
  state: string;
  latitude: number;
  longitude: number;
}

export interface Location {
  zip_code: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  county: string;
}
export interface SearchResult {
  resultIds: string[];
  total: number;
  next: string;
  prev: string;
}

function Search(): JSX.Element {
  const location: RouterLocation = useLocation();
  const [filters, setFilters] = useState<FiltersState>({
    search: [],
    breeds: location.state || [],
    ageMin: 0,
    ageMax: 15,
  });
  const [sort, setSort] = useState<SortState>({
    sortBy: "breed",
    orderBy: "asc",
  });
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult>({
    resultIds: [],
    total: 0,
    next: "",
    prev: "",
  });
  const [page, setPage] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isMobileView, setIsMobileView] = useState<boolean>(
    window.matchMedia("(max-width: 1024px)").matches
  );

  const [openedDog, setOpenedDog] = useState<Dog | null>(null);

  const [isFilterPageVisible, setIsFilterPageVisible] =
    useState<boolean>(false);
  const [isSidebarPageVisible, setIsSidebarPageVisible] =
    useState<boolean>(false);

  const [showCardModal, setShowCardModal] = useState<boolean>(false);

  const signalRef = useRef<AbortController>(null);

  const { favorites, setFavorites } = useAuth();

  function createAbortController() {
    signalRef.current?.abort();
    const controller = new AbortController();
    signalRef.current = controller;
    return controller;
  }

  const fetchDogsData = useCallback(
    async (curPage: number, prevPage: number): Promise<void | undefined> => {
      setError(null);
      setIsLoading(true);

      const controller = createAbortController();

      let url: string;

      if (curPage > prevPage) {
        url = await getSearchUrl(filters, sort, searchResult.next);
      } else if (curPage < prevPage) {
        url = await getSearchUrl(filters, sort, searchResult.prev);
      } else {
        url = await getSearchUrl(filters, sort, "");
      }

      try {
        const searchRes: SearchResult = await getDogIds(url, controller.signal);
        setSearchResult(searchRes);
        const dogObjs: Dog[] = await getDogsData(
          searchRes.resultIds,
          controller.signal
        );
        setDogs(dogObjs);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        } else if (err instanceof Error || err instanceof TypeError) {
          if ((err as Error).message === "Failed to fetch")
            setError("Internal Server Error");
          else setError((err as Error).message);
        } else setError("An Unknown error has occured");
      } finally {
        setIsLoading(false);
        setPage(curPage);
      }
    },
    [filters, sort, searchResult.next, searchResult.prev]
  );

  useEffect(() => {
    const mediaQuery: MediaQueryList = window.matchMedia("(max-width: 1024px)");

    const handleMediaChange = (event: MediaQueryListEvent): false | void =>
      setIsMobileView(event.matches);

    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      signalRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    fetchDogsData(0, 0);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort]);

  const updateSortBy = (sortBy: string): void => {
    setSort((sort) => ({ ...sort, sortBy: sortBy }));
  };

  const updateOrderBy = (orderBy: string): void => {
    setSort((sort) => ({ ...sort, orderBy: orderBy }));
  };

  const updateAgeMin = (ageMin: number[]): void => {
    setFilters((prev: FiltersState) => ({ ...prev, ageMin: ageMin[0] }));
  };

  const updateAgeMax = (ageMax: number[]): void => {
    setFilters((prev: FiltersState) => ({ ...prev, ageMax: ageMax[0] }));
  };

  const updateFilters = (filter: keyof FiltersState, value: string): void => {
    const updatedFilters: FiltersState = {
      ...filters,
      [filter]: Array.isArray(filters[filter])
        ? filters[filter].filter((val) => val !== value)
        : filter === "ageMin"
        ? 0
        : 15,
    };

    setFilters(updatedFilters);
  };

  const clearFilters = (): void => {
    setFilters({
      search: [],
      breeds: [],
      ageMin: 0,
      ageMax: 15,
    });
  };

  useEffect(() => {
    setIsFilterPageVisible(false);
  }, [filters, sort]);

  const toggleModal = (dogId: string): void => {
    const chosenDog: Dog = dogs.find((dog) => dog.id === dogId)!;
    setOpenedDog(chosenDog);
    setShowCardModal(true);
  };

  const toggleFavorite = (dogId: string): void => {
    setFavorites((favs: FavoritesState) => {
      return favs.includes(dogId)
        ? favs.filter((id) => id !== dogId)
        : [...favs, dogId];
    });
  };

  return (
    <main
      className="w-full min-h-screen h-full flex flex-col"
      style={{
        background: `url(${spotsBg})`,
        backgroundRepeat: "repeat",
        backgroundSize: "contain",
      }}
    >
      <Navbar />
      <Modal
        dog={openedDog}
        showModal={showCardModal}
        setShowModal={setShowCardModal}
        displayingMatch={false}
        favorite={openedDog ? favorites.includes(openedDog.id) : false}
        toggleFavorite={toggleFavorite}
        isInSearch={true}
      />
      {isMobileView && (
        <section
          role="region"
          aria-label="Search controls"
          className="flex items-center justify-between p-4"
        >
          <Badge
            className="w-max h-max cursor-pointer bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0))] backdrop-blur-lg shadow-xs"
            variant={"outline"}
            onClick={() => setIsSidebarPageVisible(true)}
          >
            <SlidersHorizontal size={24} />
          </Badge>
          <Badge
            role="status"
            aria-live="polite"
            className="text-xl text-valentino shadow-sm"
            variant={"secondary"}
          >
            {searchResult.total < 1000
              ? searchResult.total
              : String(searchResult.total / 1000).includes(".")
              ? `${(searchResult.total / 1000).toFixed(1)}K`
              : `${searchResult.total / 1000}K`}{" "}
            Dogs Found
          </Badge>
          <Badge
            className="w-max h-max cursor-pointer bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0))] backdrop-blur-lg shadow-xs"
            variant={"outline"}
            onClick={() => setIsFilterPageVisible(true)}
          >
            <Funnel size={24} />
          </Badge>
        </section>
      )}
      <Filterbar
        setFilters={setFilters}
        updateSortBy={updateSortBy}
        updateOrderBy={updateOrderBy}
        sort={sort}
        searchResult={searchResult}
        isFilterPageVisible={isFilterPageVisible}
        setIsFilterPageVisible={setIsFilterPageVisible}
      />
      <section
        aria-label="Page content"
        className="lg:mt-4 w-full lg:max-w-screen-2xl lg:self-center grid grid-cols-[min-content_1fr] grid-rows-[min-content_1fr]"
      >
        <Sidebar
          filters={filters}
          setFilters={setFilters}
          updateAgeMin={updateAgeMin}
          updateAgeMax={updateAgeMax}
          isSidebarPageVisible={isSidebarPageVisible}
          setIsSidebarPageVisible={setIsSidebarPageVisible}
        />
        <Filters
          filters={filters}
          clearFilters={clearFilters}
          updateFilters={updateFilters}
        />
        <section
          role="region"
          aria-label="Results"
          aria-live="polite"
          className="col-span-full lg:col-span-1 lg:col-start-[2] lg:row-span-full flex flex-col px-6 lg:px-0"
        >
          <Error error={error} />
          {dogs.length > 0 && !error && (
            <Cards
              dogs={dogs}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              isLoading={isLoading}
              toggleModal={toggleModal}
            />
          )}
          {!error && dogs.length > 0 && (
            <PaginationSearch
              page={page}
              searchResult={searchResult}
              fetchDogsData={fetchDogsData}
            />
          )}
        </section>
      </section>
    </main>
  );
}

export default Search;
